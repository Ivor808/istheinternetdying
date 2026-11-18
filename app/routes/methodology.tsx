import { createFileRoute, Link } from '@tanstack/react-router';
import { SITE_URL } from '@/data/site';
import { providerConfigs } from '@/providers/config';
import { COVERAGE_THRESHOLD, TRAILING_RECOMPUTE_DAYS } from '@/scoring/daily-index';
import { SEVERITY_FLOOR } from '@/scoring/provider-score';

const PROVIDER_COUNT = providerConfigs.length;
const COVERAGE_PCT = Math.round(COVERAGE_THRESHOLD * 100);

const TITLE = 'How the Death Index Is Calculated — Is The Internet Dying?';
const DESCRIPTION = `Methodology behind the Death Index: how public status page incidents from ${PROVIDER_COUNT} providers become per-provider, category and global reliability scores.`;

export const Route = createFileRoute('/methodology')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: `${SITE_URL}/methodology` },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}/methodology` }],
  }),
  component: Methodology,
});

function Methodology() {
  return (
    <div className="dashboard">
      <header style={{ padding: '2rem 1rem 0' }}>
        <Link
          to="/"
          style={{
            color: '#999',
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
            We currently track <strong style={{ color: '#ddd' }}>{PROVIDER_COUNT} providers</strong>{' '}
            across 6 categories: cloud infrastructure, AI, developer tools,
            productivity, communications, and fintech.
          </p>
          <p>
            Only real service degradation is counted. Incidents with{' '}
            <code style={codeStyle}>impact: "none"</code> (informational posts,
            rollout notices) or{' '}
            <code style={codeStyle}>impact: "maintenance"</code> (scheduled
            work filed as an incident) are filtered out, as is any impact level
            we don't recognise. An incident starts when the provider says the
            problem began (<code style={codeStyle}>started_at</code>), which is
            sometimes earlier than when it was posted.
          </p>
        </Section>

        <Section title="How much history we have">
          <p>
            The Statuspage API only returns each provider's{' '}
            <strong style={{ color: '#ddd' }}>~50 most recent incidents</strong>,
            with no way to page further back. So we don't have years of history:
            we have what we've collected since we started checking daily, plus
            whatever was still in each feed at the time. For a busy provider
            that's a few weeks; for a quiet one it can be much longer.
          </p>
          <p>
            A provider's data counts as <strong style={{ color: '#ddd' }}>complete</strong>{' '}
            from the oldest incident we've seen in its feed, as long as each
            check overlaps the previous one. If we miss enough checks that
            incidents could have scrolled off the feed in between, its complete
            record restarts from that point.
          </p>
          <p>
            A provider <strong style={{ color: '#ddd' }}>covers</strong> a day
            when its data is complete for that day's whole 7-day window. We only
            publish the index for days where at least{' '}
            <strong style={{ color: '#ddd' }}>{COVERAGE_PCT}% of providers</strong>{' '}
            are covered, and uncovered providers are left out of that day rather
            than counted as perfect. That's why the chart starts when it does.
          </p>
        </Section>

        <Section title="Per-provider scoring: the severity envelope">
          <p>
            Each provider gets a daily reliability score from 0 to 100, computed
            as a <strong style={{ color: '#ddd' }}>7-day rolling average</strong>.
          </p>

          <p>
            <strong style={{ color: '#ddd' }}>The problem with naive scoring:</strong>{' '}
            Not all providers report incidents the same way. Some (like Twilio)
            log every individual carrier route issue as a separate incident — so
            "SMS delays to 5 carriers" becomes 5 overlapping minor incidents.
            Others roll the same situation into one. If we simply sum deductions
            per incident, granular reporters get unfairly penalized.
          </p>

          <p>
            <strong style={{ color: '#ddd' }}>Our solution: the severity envelope.</strong>{' '}
            Instead of counting incidents, we ask: <em>at any given moment
            during the day, what was the worst thing happening?</em>
          </p>

          <p>For each day, we build a timeline and find the maximum severity active at each moment:</p>

          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>5 overlapping minor incidents = same score as 1 minor incident covering the same period</li>
            <li>A minor + a major happening simultaneously = scored as major for the overlap</li>
            <li>Two non-overlapping incidents both count fully — they're separate periods of degradation</li>
          </ul>

          <p>We then deduct from 100 based on how many hours fell into each severity tier:</p>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Max severity at that moment</th>
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
            <strong style={{ color: '#ddd' }}>Severity floors:</strong> a day
            can only fall so far for the worst severity it saw, so a minor issue
            left in "monitoring" all day isn't scored like a full outage:
          </p>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Worst severity that day</th>
                <th style={thStyle}>Lowest possible day score</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><span style={{ color: '#eab308' }}>Minor</span></td>
                <td style={tdStyle}>{SEVERITY_FLOOR[1]}</td>
              </tr>
              <tr>
                <td style={tdStyle}><span style={{ color: '#f97316' }}>Major</span></td>
                <td style={tdStyle}>{SEVERITY_FLOOR[2]}</td>
              </tr>
              <tr>
                <td style={tdStyle}><span style={{ color: '#ef4444' }}>Critical</span></td>
                <td style={tdStyle}>{SEVERITY_FLOOR[3]}</td>
              </tr>
            </tbody>
          </table>

          <p>
            The provider's score is the average of the 7 daily scores ending on
            that date. This means a bad day drags the score down for a week,
            then naturally rolls off.
          </p>

          <p>
            <strong style={{ color: '#ddd' }}>Daily scoring:</strong> a day is
            scored once it's over (UTC), so today isn't on the index yet. Each
            run rescores the last {TRAILING_RECOMPUTE_DAYS} days, so incidents
            resolved or reclassified after the fact still land on the right
            days; older days stay fixed. Scores keep full precision throughout
            and are only rounded for display.
          </p>

          <p>
            <strong style={{ color: '#ddd' }}>Duration caps:</strong>{' '}
            Some providers leave incidents open on their status page for weeks —
            not because there's an active outage, but because it's a known issue
            being tracked. A "minor" GPU booting issue open for 118 days is not
            the same as 118 days of downtime. To prevent stale entries from
            permanently tanking a score, we cap the scoring impact of any single
            incident:
          </p>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Max scoring duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><span style={{ color: '#ef4444' }}>Critical</span></td>
                <td style={tdStyle}>3 days — real critical outages get resolved fast</td>
              </tr>
              <tr>
                <td style={tdStyle}><span style={{ color: '#f97316' }}>Major</span></td>
                <td style={tdStyle}>5 days</td>
              </tr>
              <tr>
                <td style={tdStyle}><span style={{ color: '#eab308' }}>Minor</span></td>
                <td style={tdStyle}>7 days — minor issues can linger longer</td>
              </tr>
            </tbody>
          </table>

          <p style={{ color: '#999', fontSize: '0.85rem' }}>
            <em>The raw incident data is still stored with real dates — the cap
            only applies during score computation.</em>
          </p>

          <p style={{ color: '#999', fontSize: '0.85rem' }}>
            <em>Example: A provider has 3 overlapping minor SMS delivery incidents
            from 10am–2pm (4 hours), plus 1 major API outage from 1pm–2pm (1 hour).
            The envelope is: 3 hours minor + 1 hour major. Score: 100 − (3×5 + 1×15) = 70.
            Without the envelope model, this would score 100 − (4×5 + 4×5 + 4×5 + 1×15) = 25 —
            a massive over-penalty.</em>
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
            Global reliability is the{' '}
            <strong style={{ color: '#ddd' }}>average of all category scores</strong>,
            with equal weight per category. This prevents any one category with
            lots of providers (e.g., developer tools) from dominating the index.
          </p>
          <p>
            The Death Index is that number flipped, so{' '}
            <strong style={{ color: '#ddd' }}>higher is worse</strong>:
          </p>
          <p style={{ fontFamily: 'monospace', color: '#ddd', margin: '1rem 0' }}>
            Death Index = 100 − global reliability
          </p>
          <p>
            0 means every service had a clean week; 100 means everything was down.
            Category numbers on the site are flipped the same way.
          </p>
          <p>
            A provider is only included for a given date if it covers that date
            (see <em>how much history we have</em>). This avoids inflating the
            score with providers we have no real data for.
          </p>
        </Section>

        <Section title="Normal">
          <p>
            The shaded "normal" range on the index and category charts is the
            middle half of all past values (25th to 75th percentile). A reading
            above it is worse than usual.
          </p>
        </Section>

        <Section title="The clock">
          <p>
            The clock is a picture of the same number, after the{' '}
            <a
              href="https://thebulletin.org/doomsday-clock/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#ff4444', textDecoration: 'none' }}
            >
              Bulletin of the Atomic Scientists' Doomsday Clock
            </a>
            : at 0 the hand points to six o'clock, and it sweeps up to midnight
            as the index approaches 100.
          </p>
        </Section>

        <Section title="Right now">
          <p>
            The index is scored once a day, after each day ends. The "having
            issues right now" list is separate: every few minutes we read each
            provider's current status (the same status page, its{' '}
            <code>status.json</code> summary) and list any that report a minor,
            major or critical problem. Maintenance doesn't count.
          </p>
        </Section>

        <Section title="The AI Era line">
          <p>
            We mark{' '}
            <strong style={{ color: '#ddd' }}>January 1, 2026</strong> as the
            symbolic start of mainstream AI adoption across product categories.
            The red line only appears on a chart when there's covered data on
            both sides of it, since a before/after comparison needs a "before".
          </p>
          <p>
            The index's covered data starts after that date, so for now the
            line doesn't appear on the index chart. The CVE chart uses a
            separate source (the NVD) that goes back further.
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
              History only exists from when we started collecting. Status page
              feeds show recent incidents only, so we can't reconstruct earlier
              years, and there's no pre-AI baseline to compare against yet.
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
          color: '#888',
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
