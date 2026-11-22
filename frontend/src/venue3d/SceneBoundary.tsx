import React from 'react';

interface SceneBoundaryProps {
  onError: () => void;
  children: React.ReactNode;
}

/** A failing 3D scene must not take the ticket page down; the 2D map takes over. */
export class SceneBoundary extends React.Component<SceneBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Venue scene failed, falling back to the flat map:', error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
