import { Component } from 'react'

/**
 * Catches errors in the part of the app it wraps, so one failure (no WebGL,
 * a model that won't load…) can't blank the whole page.
 *
 * `fallback` may be an element or a function `(error) => element`.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`[watch] ${this.props.name ?? 'Component'} failed:`, error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const { fallback } = this.props
    return typeof fallback === 'function' ? fallback(error) : (fallback ?? null)
  }
}
