import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/methodology')({
  component: Methodology,
});

function Methodology() {
  return (
    <div className="dashboard">
      <header style={{ padding: '2rem 1rem 0' }}>
        <Link
          to="/"
          style={{
            color: '#666',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
          }}
        >
          ← back to the index
        </Link>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 900,
            color: '#e0e0e0',
            fontFamily: 'monospace',
            marginTop: '1rem',
          }}
        >
          how we calculate the{' '}
          <span style={{ color: '#ff4444' }}>death</span> index
        </h1>
      </header>

      <div
        style={{
          padding: '2rem 1rem',
          color: '#bbb',
          fontSize: '0.95rem',
          lineHeight: 1.8,
          maxWidth: '700px',
        }}
      >
        <Section title="The thesis">
          <p>
            As AI adoption accelerates across every product category, does
            overall service reliability degrade? The Death Index tracks this by
            treating internet service reliability like a market index — a single
            composite score representing ecosystem health.
          </p>
          <p>
            We don't care if one particular service is down right now. We care
            about the <em>trend</em>. Is the internet getting worse?
          </p>
        </Section>

        <Section title="Data source">
          <p>
            We pull incident data from publicly available{' '}
            <strong style={{ color: '#ddd' }}>Atlassian Statuspage</strong> APIs.
            Hundreds of major companies use Statuspage to run their public status
            pages, and each one exposes a consistent JSON API at{' '}
            <code style={codeStyle}>/api/v2/incidents.json</code>.
          </p>
          <p>
            We currently track <strong style={{ color: '#ddd' }}>51 providers</strong>{' '}
            across 6 categories: cloud infrastructure, AI, developer tools,
            productivity, communications, and fintech.
          </p>
          <p>
            Only real service degradation is counted. Incidents with{' '}
            <code style={codeStyle}>impact: "none"</code> (informational posts,
            scheduled maintenance, rollout notices) are filtered out.
          </p>
        </Section>

        <Section title="Per-provider scoring">
          <p>
            Each provider gets a daily reliability score from 0 to 100, computed
            as a <strong style={{ color: '#ddd' }}>7-day rolling average</strong>.
          </p>
          <p>For each day in the trailing 7-day window, we start at 100 and deduct points based on incident severity and duration:</p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Points deducted per hour</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>
                  <span style={{ color: '#eab308' }}>Minor</span> — degraded performance
                </td>
                <td style={tdStyle}>5</td>
              </tr>
              <tr>
                <td style={tdStyle}>
                  <span style={{ color: '#f97316' }}>Major</span> — partial outage
                </td>
                <td style={tdStyle}>15</td>
              </tr>
              <tr>
                <td style={tdStyle}>
                  <span style={{ color: '#ef4444' }}>Critical</span> — full outage
                </td>
                <td style={tdStyle}>30</td>
              </tr>
            </tbody>
          </table>
          <p>
            Each day floors at 0 (can't go negative). The provider's score is the
            average of the 7 daily scores. This means a bad day drags the score
            down for a week, then naturally rolls off.
          </p>
        </Section>

        <Section title="Category scores">
          <p>
            Providers are grouped into categories. Each category's score is the{' '}
            <strong style={{ color: '#ddd' }}>simple average</strong> of its
            provider scores — every provider within a category has equal weight.
          </p>
          <p>Current categories:</p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>Cloud Infrastructure</li>
            <li>AI Services</li>
            <li>Developer Tools</li>
            <li>Productivity</li>
            <li>Communications</li>
            <li>Fintech</li>
          </ul>
        </Section>

        <Section title="The Death Index (global score)">
          <p>
            The global Death Index is the{' '}
            <strong style={{ color: '#ddd' }}>average of all category scores</strong>,
            with equal weight per category. This prevents any one category with
            lots of providers (e.g., developer tools) from dominating the index.
          </p>
          <p>
            A provider is only included in the index for a given date if it has
            at least one historical incident on or before that date. This avoids
            inflating the score with providers we have no real data for.
          </p>
        </Section>

        <Section title="The clock">
          <p>
            The clock maps the Death Index to a "minutes to midnight" metaphor,
            inspired by the{' '}
            <a
              href="https://thebulletin.org/doomsday-clock/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#ff4444', textDecoration: 'none' }}
            >
              Bulletin of the Atomic Scientists' Doomsday Clock
            </a>
            .
          </p>
          <p>The mapping is linear:</p>
          <p style={{ fontFamily: 'monospace', color: '#ddd', margin: '1rem 0' }}>
            minutes to midnight = 12 × (score / 100)
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Minutes to midnight</th>
                <th style={thStyle}>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>100</td><td style={tdStyle}>12.0</td><td style={tdStyle}>Everything's fine (noon)</td></tr>
              <tr><td style={tdStyle}>75</td><td style={tdStyle}>9.0</td><td style={tdStyle}>Some degradation</td></tr>
              <tr><td style={tdStyle}>50</td><td style={tdStyle}>6.0</td><td style={tdStyle}>Significant issues</td></tr>
              <tr><td style={tdStyle}>25</td><td style={tdStyle}>3.0</td><td style={tdStyle}>Widespread outages</td></tr>
              <tr><td style={tdStyle}>0</td><td style={tdStyle}>0.0</td><td style={tdStyle}>Midnight (total meltdown)</td></tr>
            </tbody>
          </table>
        </Section>

        <Section title="The AI Era line">
          <p>
            The vertical red line on the chart marks{' '}
            <strong style={{ color: '#ddd' }}>January 1, 2026</strong> — the
            symbolic start of mainstream AI adoption across product categories.
            Data before this line is the baseline. Data after is the experiment.
          </p>
          <p>
            Monthly data points are computed for 2024–2025 (pre-AI baseline).
            Daily data points from January 2026 onward.
          </p>
        </Section>

        <Section title="Limitations">
          <ul style={{ paddingLeft: '1.5rem' }}>
            <li>
              We only track providers that use Atlassian Statuspage. Major
              services like AWS, Google Cloud, Slack, and Stripe use custom
              status pages we can't yet parse.
            </li>
            <li>
              Status pages are self-reported. Companies decide what to disclose
              and how to classify severity. We take them at their word.
            </li>
            <li>
              Historical data depth varies by provider. Some go back to 2016,
              others only have a few months.
            </li>
            <li>
              The index weights all categories equally. You might argue cloud
              infrastructure outages are more impactful than a productivity
              tool going down — we don't make that judgment call.
            </li>
          </ul>
        </Section>

        <Section title="Open source">
          <p>
            This project is open source. If you want to dig into the code,
            add providers, or improve the scoring methodology, contributions
            are welcome.
          </p>
        </Section>
      </div>

      <footer
        style={{
          borderTop: '1px solid #1a1a1a',
          marginTop: '3rem',
          padding: '2rem 1rem',
          textAlign: 'center',
          color: '#444',
          fontSize: '0.75rem',
          lineHeight: 1.6,
        }}
      >
        <p>
          istheinternetdying.com is an independent project. The Death Index is
          computed from publicly available status page data and represents an
          analytical interpretation — not an endorsement of or affiliation with
          any listed provider.
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          Not financial, operational, or professional advice. Just vibes and math.
        </p>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2
        style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          color: '#e0e0e0',
          fontFamily: 'monospace',
          marginBottom: '0.75rem',
          textTransform: 'lowercase',
        }}
      >
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </section>
  );
}

const codeStyle: React.CSSProperties = {
  background: '#1a1a1a',
  padding: '0.15rem 0.4rem',
  borderRadius: '3px',
  fontSize: '0.85em',
  fontFamily: 'monospace',
  color: '#ddd',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  margin: '0.5rem 0',
};

const thStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  textAlign: 'left',
  color: '#888',
  borderBottom: '1px solid #333',
  fontWeight: 'normal',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderBottom: '1px solid #1a1a1a',
  color: '#ccc',
};
