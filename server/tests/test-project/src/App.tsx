// Test file for PokeUI agent validation
// This file contains intentional issues for the agent to fix

import React from 'react';

export function App() {
  return (
    <div className="app">
      <header>
        <h1>Welcome to My App</h1>
        <button className="login-btn">Login</button>
      </header>

      <main>
        <section className="hero">
          <h2>Get Started Today</h2>
          <p>This is a sample application for testing PokeUI annotations.</p>
          <button className="cta-btn">Sign Up Now</button>
        </section>

        <section className="features">
          <div className="feature-card">
            <h3>Feature One</h3>
            <p>Description of feature one goes here.</p>
          </div>
          <div className="feature-card">
            <h3>Feature Two</h3>
            <p>Description of feature two goes here.</p>
          </div>
        </section>
      </main>

      <footer>
        <p>Copyright 2024 My App</p>
      </footer>
    </div>
  );
}
