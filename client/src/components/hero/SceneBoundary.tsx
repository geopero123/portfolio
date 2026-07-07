import { Component } from 'react'
import type { ReactNode } from 'react'
import { HeroFallback } from './HeroFallback'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** If WebGL context creation (or anything inside the scene) throws, degrade to the CSS hero. */
export class SceneBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[hero] WebGL scene failed, falling back to CSS hero:', error)
  }

  render() {
    return this.state.failed ? <HeroFallback /> : this.props.children
  }
}
