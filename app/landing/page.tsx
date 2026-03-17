"use client"

import Image from "next/image"

export default function Landing() {

  return (
    <main className="landing">

      {/* NAVBAR */}
      <nav className="nav">

        <div className="logo">
          <Image src="/logo.png" alt="Ankoryn" width={34} height={34} />
          <span>Ankoryn</span>
        </div>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="/">Open App</a>
        </div>

      </nav>


      {/* HERO */}
      <section className="hero">

        <div className="hero-glow" />

        <Image src="/logo.png" alt="logo" width={80} height={80} />

        <h1>
          Switch AI models
          <br/>
          without losing context
        </h1>

        <p>
          Ankoryn is an AI Workspace OS.  
          Chat with GPT, Claude, Gemini, Mistral or local models —
          while your workspace keeps the memory.
        </p>

        <div className="hero-buttons">
          <a className="primary" href="/">
            Start Workspace
          </a>

          <a className="secondary" href="#features">
            Learn More
          </a>
        </div>

      </section>


      {/* PROBLEM */}
      <section className="section">

        <h2>AI tools forget everything</h2>

        <p className="section-sub">
          Every conversation starts from zero.
        </p>

        <div className="problem-grid">

          <div className="card">
            <h3>Explain your project</h3>
            <p>Every time you open a new chat.</p>
          </div>

          <div className="card">
            <h3>Repeat your goals</h3>
            <p>AI loses context between sessions.</p>
          </div>

          <div className="card">
            <h3>Switch models</h3>
            <p>You must start from scratch again.</p>
          </div>

        </div>

      </section>


      {/* SOLUTION */}
      <section className="section alt">

        <h2>Your workspace remembers</h2>

        <p className="section-sub">
          Ankoryn separates your context from the AI model.
        </p>

        <div className="solution-box">

          <p>
            Workspace Memory
          </p>

          <span>↓</span>

          <p>
            Context Engine
          </p>

          <span>↓</span>

          <p>
            GPT · Claude · Gemini · Mistral · Ollama
          </p>

        </div>

      </section>


      {/* FEATURES */}
      <section id="features" className="section">

        <h2>Built for persistent AI workflows</h2>

        <div className="features">

          <div className="feature">
            <h3>Persistent Workspace</h3>
            <p>
              Projects, decisions and goals become context
              that grows over time.
            </p>
          </div>

          <div className="feature">
            <h3>Instant Model Switching</h3>
            <p>
              Use the best model for the task without losing
              workspace memory.
            </p>
          </div>

          <div className="feature">
            <h3>Structured Memory</h3>
            <p>
              Core facts, memories and summaries keep the AI
              aligned with your work.
            </p>
          </div>

          <div className="feature">
            <h3>Bring Your Own Models</h3>
            <p>
              Use OpenAI, Claude, Gemini, Mistral or Ollama.
              Your keys stay local.
            </p>
          </div>

        </div>

      </section>


      {/* HOW IT WORKS */}
      <section id="how" className="section alt">

        <h2>How it works</h2>

        <div className="steps">

          <div>
            <h4>1. Create a workspace</h4>
            <p>Start a project context.</p>
          </div>

          <div>
            <h4>2. Chat normally</h4>
            <p>Ankoryn builds memory automatically.</p>
          </div>

          <div>
            <h4>3. Switch models</h4>
            <p>Your context stays intact.</p>
          </div>

        </div>

      </section>


      {/* CTA */}
      <section className="cta">

        <h2>Stop restarting AI</h2>

        <p>Build a workspace that remembers.</p>

        <a href="/" className="primary large">
          Start Workspace
        </a>

      </section>

<footer className="footer">

  <div className="footer-grid">

    <div>
      <h4>About</h4>
      <a href="#features">Features</a>
      <a href="#how">How it works</a>
      <a href="/">Open App</a>
    </div>

    <div>
      <h4>Resources</h4>
      <a href="#">Roadmap</a>
      <a href="#">Changelog</a>
      <a href="#">Status</a>
    </div>

    <div>
      <h4>Documentation</h4>
      <a href="#">Getting Started</a>
      <a href="#">Local Install</a>
    </div>

    <div>
      <h4>Legal</h4>
      <a href="#">Terms</a>
      <a href="#">Privacy</a>
    </div>

  </div>


  <div className="footer-bottom">

    <div className="footer-left">
      © {new Date().getFullYear()} Ankoryn
      <span className="creator">
        Created by{" "}
        <a
          href="https://ayteelabs.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          AyTee Labs
        </a>
      </span>
    </div>


    <div className="footer-social">

      <a
        href="https://x.com/ankoryn"
        target="_blank"
        rel="noopener noreferrer"
      >
        X
      </a>

    </div>

  </div>

</footer>

    </main>
  )
}