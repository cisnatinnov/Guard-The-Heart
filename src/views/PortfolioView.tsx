import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { saveTheme } from '../services/theme'
import '../styles/portfolio.css'

const screens = [
  { id: 'console', label: 'Event console', image: '/portfolio/event-console.jpg', alt: 'Fight the Dragon event console showing the five default teams and host navigation', description: 'A dedicated workspace for teams, challenges, scores, and event controls.' },
  { id: 'stage', label: 'Public display', image: '/portfolio/public-display.jpg', alt: 'Fight the Dragon presentation with the Dragon Warden, Spark, and Storm Ranger', description: 'A separate presentation for the audience, synchronized with the host in the same browser.' },
  { id: 'scores', label: 'Live scoreboard', image: '/portfolio/scoreboard.jpg', alt: 'Theme-aware scoreboard showing the five default teams before scores are recorded', description: 'Readable team scores and GP balances, with rankings calculated from saved game state.' },
] as const

export function PortfolioView() {
  const theme = useTheme()
  const [screen, setScreen] = useState(0)
  const selected = screens[screen]

  useEffect(() => {
    const previousTitle = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousDescription = description?.content
    document.title = 'Cendikia Hairy — Portfolio'
    if (description) description.content = 'Selected work by Cendikia Hairy. Explore Fight the Dragon, an offline-first team challenge and event platform.'
    return () => {
      document.title = previousTitle
      if (description && previousDescription !== undefined) description.content = previousDescription
    }
  }, [])

  return (
    <div className="portfolio">
      <a className="portfolio__skip" href="#portfolio-main">Skip to content</a>
      <header className="portfolio__header">
        <a className="portfolio__identity" href="#top" aria-label="Cendikia Hairy, back to top"><span aria-hidden="true">CH<span className="portfolio__dot">.</span></span><span>Cendikia Hairy<small>Selected work / Portfolio</small></span></a>
        <nav aria-label="Portfolio navigation"><a href="#work">Work</a><a href="#approach">Approach</a><a href="#contact">Contact ↗</a></nav>
        <a className="portfolio__download" href="/portfolio/Cendikia-Hairy-Portfolio.pdf" download="Cendikia-Hairy-Portfolio.pdf">Download portfolio <span>PDF ↓</span></a>
        <button className="ghost" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => saveTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
      </header>

      <main id="portfolio-main">
        <section className="portfolio__intro" id="top" aria-labelledby="portfolio-title">
          <p className="portfolio__eyebrow"><span /> Interfaces, interactions & a little adventure</p>
          <h1 id="portfolio-title">Thoughtful interfaces.<br /><em>Playful experiences.</em></h1>
          <div className="portfolio__intro-bottom"><p>I’m Cendikia Hairy. Explore my work through Fight the Dragon: a browser-based experience that brings team challenges, live scores, and a fantasy world together.</p><a className="portfolio__text-link" href="#work">Explore selected work <span aria-hidden="true">↘</span></a></div>
        </section>

        <section className="portfolio__work" id="work" aria-labelledby="work-title">
          <div className="portfolio__section-label"><span>01 / Featured project</span><span>Web application · PWA</span></div>
          <div className="portfolio__project-hero">
            <div className="portfolio__project-copy"><p className="portfolio__eyebrow">An event becomes an adventure</p><h2 id="work-title">Fight<br />the Dragon<span>.</span></h2><p>An offline-first command center for team challenges. Built for the host running the room and the audience following every turn.</p><div className="portfolio__actions"><a className="portfolio__button" href="#case-study">Read the case study <span aria-hidden="true">↘</span></a><Link className="portfolio__text-link" to="/">View the experience ↗</Link></div></div>
            <div className="portfolio__cast"><div className="portfolio__orbit" aria-hidden="true" /><img className="portfolio__warden" src="/characters/dragon-warden.png" alt="Dragon Warden in silver and cobalt armor, carrying a cyan crystal shield" fetchPriority="high" /><img className="portfolio__spark" src="/characters/spark.png" alt="Spark, the cobalt dragon companion" /><span className="portfolio__cast-note">Navy armor. Cyan crystals. A shared visual world.</span></div>
          </div>
          <dl className="portfolio__facts"><div><dt>Experience</dt><dd>Host console + public display</dd></div><div><dt>Foundation</dt><dd>React · TypeScript · Vite</dd></div><div><dt>Data</dt><dd>SQLite in the browser</dd></div><div><dt>Delivery</dt><dd>Installable, offline-first PWA</dd></div></dl>

          <div className="portfolio__showcase">
            <div className="portfolio__showcase-heading"><h3>One event. Two perspectives.</h3><p>The controls stay with the host.<br />The adventure belongs to the room.</p></div>
            <div className="portfolio__screen-picker" role="group" aria-label="Project screenshots">{screens.map((item, index) => <button key={item.id} aria-pressed={screen === index} onClick={() => setScreen(index)}>{item.label}</button>)}</div>
            <figure className="portfolio__browser"><div className="portfolio__browser-bar" aria-hidden="true"><span>● ● ●</span><span>Fight the Dragon / {selected.label}</span><span>↗</span></div><img src={selected.image} alt={selected.alt} width="1440" height="1000" loading="lazy" /><figcaption aria-live="polite">{selected.description} <span>Demo state · default teams</span></figcaption></figure>
          </div>
        </section>

        <section className="portfolio__case" id="case-study" aria-labelledby="case-title">
          <div className="portfolio__section-label"><span>02 / Behind the experience</span><span>Project case study</span></div>
          <div className="portfolio__case-intro"><h2 id="case-title">Keep the event moving.<br /><em>Keep the room engaged.</em></h2><div><p>A team event has two very different needs: precise controls for the person running it and a clear, engaging view for everyone playing.</p><p>Fight the Dragon connects those needs through shared local state, dedicated host tools, and public boards that follow the action.</p></div></div>
          <div className="portfolio__decisions">
            <article><span>01</span><h3>Design around the host</h3><p>Grouped navigation brings team setup, challenge management, and results into one workspace. A separate public window keeps operational controls away from the audience.</p></article>
            <article><span>02</span><h3>Make state dependable</h3><p>sql.js runs SQLite in the browser, with local persistence and synchronization across tabs on the same origin and browser profile. Saved results survive reloads.</p></article>
            <article><span>03</span><h3>Make every action count</h3><p>Scoring, card effects, and attacks use persisted records and duplicate-submission protection. A GP transaction ledger makes balance changes traceable.</p></article>
          </div>
          <div className="portfolio__journey"><div><p className="portfolio__eyebrow">The event loop</p><h3>From first question<br />to final podium.</h3></div><ol><li><b>Prepare</b><span>Set up teams and turn order.</span></li><li><b>Play</b><span>Decode clues, match cards, face the dragon.</span></li><li><b>Resolve</b><span>Calculate scores, rewards, and tactical effects.</span></li><li><b>Celebrate</b><span>Show the leaderboard and podium.</span></li></ol></div>
        </section>

        <section className="portfolio__approach" id="approach" aria-labelledby="approach-title">
          <div className="portfolio__section-label"><span>03 / Approach & craft</span><span>What this project demonstrates</span></div>
          <div className="portfolio__approach-grid"><div><h2 id="approach-title">The details are<br /><em>part of the experience.</em></h2><p>Visual consistency, resilient state, and clear feedback all serve the same goal: helping people focus on the event.</p><a className="portfolio__text-link" href="https://www.linkedin.com/in/cendikia-hairy/" target="_blank" rel="noreferrer">More about me on LinkedIn ↗</a></div><div className="portfolio__capabilities"><article><h3>Interface engineering</h3><p>Responsive React views, typed components, shared themes, keyboard focus, and reduced-motion support.</p></article><article><h3>Local application architecture</h3><p>Sequelize models, SQLite via WebAssembly, browser persistence, and service-worker caching.</p></article><article><h3>Behavior verification</h3><p>Vitest coverage for rules and data, plus Playwright flows for host controls, synchronization, and responsive layouts.</p></article></div></div>
          <div className="portfolio__stack" aria-label="Project technology stack">{['React', 'TypeScript', 'Vite', 'Sequelize', 'sql.js', 'Vitest', 'Playwright', 'PWA'].map(item => <span key={item}>{item}</span>)}</div>
        </section>

        <section className="portfolio__contact" id="contact" aria-labelledby="contact-title"><p className="portfolio__eyebrow">Have a project in mind?</p><h2 id="contact-title">Let’s make something<br /><em>worth interacting with.</em></h2><a className="portfolio__button" href="https://www.linkedin.com/in/cendikia-hairy/" target="_blank" rel="noreferrer">Connect on LinkedIn <span aria-hidden="true">↗</span></a></section>
      </main>
      <footer className="portfolio__footer"><span>© {new Date().getFullYear()} Cendikia Hairy</span><span>Built with care. Inspired by adventure.</span><a href="#top">Back to top ↑</a></footer>
    </div>
  )
}
