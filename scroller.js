import React from 'react'
import cn from 'classnames'

import './scroller.less'

class Scroller extends React.Component {

	constructor(props) {
		super(props)

		this.state = {
			screenWidth: 0,
			screenHeight: 0,
			totalTagWidth: 0,
			offset: 0,
			showNext: true,
			showPrev: false,
			locked: props.locked,
			swipe: {},
			styles: {},
			animating: false, // whether or not the bar is scrolling with momentum
			touchStarted: false, // are we listening for touchMove?
			settings: {
				scrollsPerScreen: props.scrollsPerScreen || 2, // how many scrolls per screenWidth
				controlWidth: props.controlWidth || 36, // width of prev/next buttons
				minSwipeStr: props.minSwipeStr || 40 // pixel acceleration to determine if swipe
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

	updateDimensions() {
		let w = window,
			d = document,
			documentElement = d.documentElement,
			body = d.getElementsByTagName('body')[0],
			screenWidth = w.innerWidth || documentElement.clientWidth || body.clientWidth,
			screenHeight = w.innerHeight || documentElement.clientHeight || body.clientHeight,
			total = 0,
			totalTagWidth = 0

		const scrollerElements = document.getElementsByClassName('scroller')

		if (scrollerElements.length > 0) {
			screenWidth = scrollerElements[0].clientWidth - (2 * this.state.settings.controlWidth) // 72 because of 2 x 36px buttons.

			let tagElements = scrollerElements[0].getElementsByClassName('tag')
			for (let i=0, e=tagElements.length; i < e; i++) {
				totalTagWidth += (tagElements[i].offsetWidth + 10) // 10px for margin-right, TODO: Move into constant or detect
			}
		}

		// Reset
		this.setState({
			screenWidth,
			screenHeight,
			totalTagWidth,
			offset: 0,
			showNext: totalTagWidth > screenWidth,
			showPrev: false,
			swipe: {},
			styles: {},
			touchStarted: false
		})
	}

	handleControl(direction) {
		if (this.state.locked) return // if a menu is open, don't allow scrolling

		const { settings } = this.state,
			newOffset = (direction === 'next') ? Math.floor(this.state.screenWidth/settings.scrollsPerScreen) : -Math.floor(this.state.screenWidth/settings.scrollsPerScreen)

		this.animate(this.state.offset + newOffset, false)
	}

	handleTouchStart(e) {
		if (!this.state.locked) {
			const startX = e.touches ? e.touches[0].pageX : e.pageX,
				startY = e.touches ? e.touches[0].pageY : e.pageY,
				swipe = {
					beginning: this.state.offset,
					startX,
					startY,
					endX: startX // prevent click swiping when touchMove doesn't fire
				}
			this.setState({
				touchStarted: true,
				swipe
			})
		}
	}

	handleTouchMove(e) {
		if (this.state.touchStarted) {
			// Prevent default
			e.preventDefault()

			// Grab touch values
			const touchX = e.touches ? e.touches[0].pageX : e.pageX,
				touchY = e.touches ? e.touches[0].pageY : e.pageY,
				dX = touchX - this.state.swipe.startX,
				dY = touchY - this.state.swipe.startY

			// Escape if vertical swipe rather than horizontal
			if ( Math.abs(dX) < Math.abs(dY) ) return

			// Store swipe strength for momentum
			const swipe = Object.assign({}, this.state.swipe)
			swipe.strength = Math.abs(touchX - swipe.endX)
			swipe.endX = touchX
			this.setState({ swipe })

			// Apply new position
			this.animate(this.state.swipe.beginning - dX, false)
		}
	}

	handleTouchEnd(e) {
		if (this.state.touchStarted && !this.state.animating) {
			// Nullify event
			e.preventDefault()

			const moved = this.state.swipe.endX - this.state.swipe.startX,
				threshold = this.state.screenWidth / 3

			// Figure out closest slide
			if ( Math.abs(moved) > threshold || this.state.swipe.strength > this.state.settings.minSwipeStr ) {
				if ( moved > 0 ) {
					this.animate(this.state.offset - this.state.screenWidth, true)
				} else {
					this.animate(this.state.offset + this.state.screenWidth, true)
				}
			}

			this.setState({
				swipe: {},
				touchStarted: false,
				showNext: this.state.offset < this.state.totalTagWidth - this.state.screenWidth,
				showPrev: this.state.offset > 0
			})
		}
	}

	animate(offset, hasMomentum) {
		// Ensure stay in bounds
		const snapMargin = this.state.animating ? this.state.settings.controlWidth : 0
		if (offset < snapMargin) {
			offset = 0
		} else if (offset > this.state.totalTagWidth - this.state.screenWidth - snapMargin) {
			offset = this.state.totalTagWidth - this.state.screenWidth
		}

		// Momentum Effect or Not
		const ease = 0.4,
			styles = {
				transform: 'translate3d(' + -offset + 'px, 0, 0)',
				transition: this.state.touchStarted ? 'none' : `all ${ease}s ease-out`
			}

		// Allow animating again
		let animating = false
		if (hasMomentum) {
			animating = true
			styles.transition = `all ${ease}s ease-out`
			window.setTimeout(function(){
				this.setState({
					animating: false
				})
			}.bind(this), ease * 1000)
		}

		this.setState({
			styles,
			offset,
			showNext: (offset < this.state.totalTagWidth - this.state.screenWidth) && !this.state.touchStarted,
			showPrev: (offset > 0) && !this.state.touchStarted,
			animating
		})
	}

	render() {
		return (
			<div className={cn('scroller', this.props.className, {locked: this.state.locked})}>
				<div className="scroller-container" style={ this.state.styles }
					onMouseDown={this.handleTouchStart}
					onMouseMove={this.handleTouchMove}
					onMouseUp={this.handleTouchEnd}
					onMouseLeave={this.handleTouchEnd}
					onTouchStart={this.handleTouchStart}
					onTouchMove={this.handleTouchMove}
					onTouchEnd={this.handleTouchEnd}>
					{this.props.children}
				</div>
				<div className={cn('control-prev', {hidden: !this.state.showPrev})} onClick={this.handleControl.bind(this, 'prev')}>&#10216;</div>
				<div className={cn('control-next', {hidden: !this.state.showNext})} onClick={this.handleControl.bind(this, 'next')}>&#10217;</div>
			</div>
		)
	}
}

export default Scroller
