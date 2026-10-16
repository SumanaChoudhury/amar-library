import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.handleReset, this.state.error)
      }

      return (
        <div
          className="pdf-status-card error"
          style={{
            margin: '40px auto',
            maxWidth: '520px',
            textAlign: 'center',
            padding: '28px',
          }}
        >
          <p className="error-title">Reader Encountered an Issue</p>
          <p style={{ color: '#7b7e72', fontSize: '13px', margin: '12px 0 20px' }}>
            {this.state.error?.message ||
              'A temporary display error occurred. Your bookshelf is safe.'}
          </p>
          <button
            type="button"
            className="primary-action-btn"
            onClick={this.handleReset}
          >
            Return to Bookshelf
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
