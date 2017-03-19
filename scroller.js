import React from 'react'
import cn from 'classnames'

import './scroller.less'

class Scroller extends React.Component {

	constructor(props) {
		super(props)

		this.state = {
			screenWidth: 0,
			totalItemWidth: 0,
			offset: 0,
			maxOffset: 0,
			showNext: true,
			showPrev: false,
			swipe: {},
			styles: {},
			animating: false, // whether or not the bar is scrolling with momentum
			touchStarted: false, // are we listening for touchMove?
			settings: {
				itemClass: props.itemClass || 'item',
				scrollsPerScreen: props.scrollsPerScreen || 2, // how many scrolls per screenWidth
				controlWidth: props.controlWidth || 36, // width of prev/next buttons
				controlMinWidth: props.controlMinWidth || 720, // min width of scroller for controls to be visible
				swipeScale: props.swipeScale || 480,
				minSwipeSpeed: props.minSwipeSpeed || 0.7, // speed to be considered a swipe
				ease: props.ease || 1
			}
		}
		this.updateDimensions = this.updateDimensions.bind(this)
		this.handleTouchStart = this.handleTouchStart.bind(this)
		this.handleTouchMove = this.handleTouchMove.bind(this)
		this.handleTouchEnd = this.handleTouchEnd.bind(this)
		this.animate = this.animate.bind(this)
	}

	componentWillReceiveProps() {
		this.updateDimensions()
	}

	componentDidMount() {
		window.addEventListener('resize', this.updateDimensions)
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.updateDimensions)
	}

	getMargins(element) {
		const margins = parseInt(window.getComputedStyle(element).marginLeft, 10) + parseInt(window.getComputedStyle(element).marginRight, 10)
		return isNaN(margins) ? 0 : margins
	}

	getControlState(direction, offset) {
		// Returns whether or not to show the controlMinWidth
		if (this.state.settings.controlMinWidth > this.state.screenWidth) {
			return false
		}

		return direction === 'next' ? offset < this.state.totalItemWidth - this.state.screenWidth : offset > 0
	}

	updateDimensions() {
		const w = window,
			d = document,
			documentElement = d.documentElement,
			body = d.getElementsByClassName('body')[0],
			scrollers = document.getElementsByClassName('scroller')

		let screenWidth = w.innerWidth || documentElement.clientWidth || body.clientWidth,
			totalItemWidth = 0,
			allowControls = true

		if (scrollers.length > 0) {
			const { settings } = this.state,
				items = scrollers[0].getElementsByClassName(settings.itemClass)
			screenWidth = scrollers[0].clientWidth - (2 * settings.controlWidth)

			for (let i = 0, e = items.length; i < e; i += 1) {
				totalItemWidth += (items[i].offsetWidth + this.getMargins(items[i]))
			}
		}

		// Determine if controls are allowed based on screenWidth
		allowControls = this.state.settings.controlMinWidth <= screenWidth

		// Reset
		this.setState({
			screenWidth,
			totalItemWidth,
			offset: 0,
			maxOffset: totalItemWidth - screenWidth,
			showNext: totalItemWidth > screenWidth && allowControls,
			showPrev: false,
			swipe: {},
			styles: {},
			touchStarted: false
		})
	}

	handleControl(direction) {
		if (this.props.locked) return // if a menu is open, don't allow scrolling

		const { settings } = this.state

		let offset = this.state.offset
		offset += (direction === 'next') ? Math.floor(this.state.screenWidth / settings.scrollsPerScreen) : -Math.floor(this.state.screenWidth / settings.scrollsPerScreen)
		this.animate(offset, this.state.settings.ease / this.state.settings.scrollsPerScreen)

		this.setState({
			showNext: this.getControlState('next', offset),
			showPrev: this.getControlState('prev', offset)
		})
	}

	handleTouchStart(e) {
		if (!this.props.locked && !this.state.animating) {
			const startX = e.touches ? e.touches[0].pageX : e.pageX,
				startY = e.touches ? e.touches[0].pageY : e.pageY,
				swipe = {
					beginning: this.state.offset,
					startX,
					startY,
					endX: startX // prevent click swiping when touchMove doesn't fire
				}

			this.setState({
				swipe,
				touchStarted: true
			})
		}
	}

	handleTouchMove(e) {
		if (this.state.touchStarted && !this.state.animating) {
			// Nullify event
			e.preventDefault()

			// Grab touch values
			const touchX = e.touches ? e.touches[0].pageX : e.pageX,
				touchY = e.touches ? e.touches[0].pageY : e.pageY,
				dX = touchX - this.state.swipe.startX,
				dY = touchY - this.state.swipe.startY

			// Escape if vertical swipe rather than horizontal
			if (Math.abs(dX) < Math.abs(dY)) return

			// Store swipe velocity for momentum
			const swipe = Object.assign({}, this.state.swipe)
			swipe.velocity = (touchX - this.state.swipe.endX) / (e.timeStamp - this.state.swipe.lastTime)
			swipe.endX = touchX
			swipe.lastTime = Math.floor(e.timeStamp)

			this.setState({
				swipe,
				showNext: false,
				showPrev: false
			})

			// Apply new position
			this.animate(this.state.swipe.beginning - dX, 0)
		}
	}

	handleTouchEnd(e) {
		let offset = this.state.offset,
			animating = false

		if (this.state.touchStarted && !this.state.animating) {
			// Does motion qualify as a "swipe"?
			if (Math.abs(this.state.swipe.velocity) > this.state.settings.minSwipeSpeed) {
				// Nullify event (prevent Tap)
				e.preventDefault()

				offset -= this.state.swipe.velocity * this.state.settings.swipeScale // new offset

				// Animate
				animating = true
				this.animate(offset, this.state.settings.ease)
			}
		}

		// Reset conditions
		this.setState({
			touchStarted: false,
			showNext: this.getControlState('next', offset) && !animating,
			showPrev: this.getControlState('prev', offset) && !animating
		})
	}

	animate(offset, ease) {
		let animating = false, // Allow animating again
			initialOffset = offset,
			travel = this.state.offset - offset,
			travelRatio = 1

		// Ensure stay in bounds and snap to edges
		const snapMargin = this.state.animating ? 2 * this.state.settings.controlWidth : 0
		if (offset < snapMargin) {
			offset = 0
			travelRatio = Math.abs(this.state.offset / travel)
		} else if (offset > this.state.maxOffset - snapMargin) {
			offset = this.state.maxOffset
			travelRatio = Math.abs((this.state.maxOffset - this.state.offset) / travel)
		}

		// Default transform
		const styles = {
			transform: `translate3d(${-offset}px, 0, 0)`,
			transition: 'none'
		}

		// Has Momentum
		if (ease > 0) {
			animating = true

			// Scale ease according to offset distance
			ease = Math.ceil(10 * ease * travelRatio) / 10
			ease = ease < 0.4 ? 0.4 : ease

			// Update Timing
			styles.transition = `all ${ease}s ease-out`

			// Delay updating state since animating
			window.setTimeout(() => {
				this.setState({
					showNext: this.getControlState('next', offset),
					showPrev: this.getControlState('prev', offset),
					swipe: {},
					animating: false
				})
			}, ease * 1000)
		}

		this.setState({
			offset,
			styles,
			animating
		})
	}

	render() {
		return (
			<div className={cn('scroller', this.props.className, { locked: this.props.locked })}>
				<div className='scroller-container' style={this.state.styles}
					onMouseDown={this.handleTouchStart}
					onMouseMove={this.handleTouchMove}
					onMouseUp={this.handleTouchEnd}
					onMouseLeave={this.handleTouchEnd}
					onTouchStart={this.handleTouchStart}
					onTouchMove={this.handleTouchMove}
					onTouchEnd={this.handleTouchEnd}
				>
					{this.props.children}
				</div>
				<div className={cn('control-prev', { hidden: !this.state.showPrev })} onClick={this.handleControl.bind(this, 'prev')}>&#10216;</div>
				<div className={cn('control-next', { hidden: !this.state.showNext })} onClick={this.handleControl.bind(this, 'next')}>&#10217;</div>
			</div>
		)
	}
}

Scroller.propTypes = {
	children: React.PropTypes.node.isRequired,
	className: React.PropTypes.string.isRequired,
	itemClass: React.PropTypes.string.isRequired
}

export default Scroller
