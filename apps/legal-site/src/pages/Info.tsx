import { useState } from "react";
import { Link } from "react-router";
import { Check, Mail, Minus } from "lucide-react";
import { Arrow, Cta, Faq, PageHero, Reveal, Strip } from "../components/Blocks";
import { COACH_PLAN, COMPARE, PLANS, SUPPORT_EMAIL } from "../site";
import privacyHtml from "../content/privacy.html?raw";
import termsHtml from "../content/terms.html?raw";

const Sep = () => <i className="strip-sep" aria-hidden="true" />;

function Cell({ value }: { value: string }) {
  if (value === "yes") return <Check className="cell-yes" aria-label="Included" strokeWidth={2.25} />;
  if (value === "no") return <Minus className="cell-no" aria-label="Not included" strokeWidth={2} />;
  return <span className="num">{value}</span>;
}

type Billing = "monthly" | "annual";
const gbp = (value: number) => `£${value.toFixed(2)}`;
/** How much cheaper the annual price works out per year, vs paying monthly for 12 months. */
const annualSaving = (monthly: number, annual: number) => Math.round((1 - annual / (monthly * 12)) * 100);

function PlanCard({
  plan,
  billing,
  delay,
  cta,
}: {
  plan: { name: string; tag?: string; who: string; monthly: number | null; annual: number | null; items: string[] };
  billing: Billing;
  delay: number;
  cta?: { to: string; label: string };
}) {
  const isFree = plan.monthly == null;
  const price = isFree ? null : billing === "monthly" ? plan.monthly! : plan.annual!;
  const saving = !isFree && billing === "annual" ? annualSaving(plan.monthly!, plan.annual!) : null;

  return (
    <Reveal delay={delay} className={`plan ${plan.tag ? "featured" : ""}`}>
      {plan.tag && <p className="plan-tag">{plan.tag}</p>}
      <h2>{plan.name}</h2>
      <div className="plan-price">
        <span className="plan-price-amount">{isFree ? "Free" : gbp(price!)}</span>
        {!isFree && <span className="plan-price-period">/ {billing === "monthly" ? "month" : "year"}</span>}
      </div>
      {saving ? <p className="plan-saving">Save {saving}% vs paying monthly</p> : <p className="plan-saving placeholder" aria-hidden="true" />}
      <p className="plan-who">{plan.who}</p>
      <ul>
        {plan.items.map((item) => (
          <li key={item}>
            <Check aria-hidden="true" strokeWidth={2.25} />
            {item}
          </li>
        ))}
      </ul>
      {cta ? (
        <Link className="btn btn-primary plan-cta" to={cta.to}>
          {cta.label} <Arrow />
        </Link>
      ) : null}
    </Reveal>
  );
}

export function Plans() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <>
      <PageHero
        eyebrow="Plans"
        title="Start free. Go further when you want to."
        lead="Every plan scores matches, runs routines and plays friends. The paid plans raise the limits and add the deeper tools."
      />
      <section className="section tight plans-section">
        <div className="wrap">
          <div className="billing-toggle" role="tablist" aria-label="Billed monthly or annually">
            <button type="button" role="tab" aria-selected={billing === "monthly"} className={billing === "monthly" ? "on" : ""} onClick={() => setBilling("monthly")}>
              Monthly
            </button>
            <button type="button" role="tab" aria-selected={billing === "annual"} className={billing === "annual" ? "on" : ""} onClick={() => setBilling("annual")}>
              Annual <span className="billing-save">Save ~35%</span>
            </button>
          </div>

          <div className="plans">
            {PLANS.map((plan, index) => (
              <PlanCard key={plan.name} plan={plan} billing={billing} delay={index * 0.07} />
            ))}
          </div>

          <div className="coach-plan-row">
            <p className="eyebrow">For coaches</p>
            <div className="plans plans-single">
              <PlanCard plan={COACH_PLAN} billing={billing} delay={0.21} cta={{ to: "/find-a-coach", label: "Apply to coach" }} />
            </div>
          </div>

          <p className="note">
            Shown in GBP. Player plans are billed through your Apple account in your own currency, so the amount charged may
            vary slightly - the coach subscription is billed separately, once your application is approved.
          </p>
        </div>
      </section>

      <section className="section alt">
        <div className="wrap">
          <Reveal className="section-head">
            <h2 className="display-l">Side by side.</h2>
          </Reveal>
          <Reveal className="table-card">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Feature</span>
                  </th>
                  {PLANS.map((plan) => (
                    <th scope="col" key={plan.name} className={plan.tag ? "featured" : ""}>
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, ...values]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {values.map((value, index) => (
                      <td key={index}>
                        <Cell value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow-grid">
          <Reveal className="section-head">
            <h2 className="display-l">Questions.</h2>
          </Reveal>
          <Faq
            items={[
              {
                q: "How do I cancel?",
                a: <p>Any time, in your Apple account under Subscriptions. You keep your plan until the end of the period you paid for.</p>,
              },
              { q: "When do the monthly limits reset?", a: <p>Once a month, on the same date each month.</p> },
              { q: "Can I change plan later?", a: <p>Yes. Upgrade or downgrade from the Plans screen in the app, or in your Apple account.</p> },
              {
                q: "Something wrong with a payment?",
                a: (
                  <p>
                    Apple handles billing and refunds. For anything else, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                  </p>
                ),
              },
              {
                q: "Is there a plan for coaches?",
                a: (
                  <p>
                    Yes, shown above - separate from the player plans. See <Link to="/find-a-coach">Find a Coach</Link> for how
                    to apply.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>
      <Cta />
    </>
  );
}

export function Support() {
  return (
    <>
      <PageHero
        eyebrow="Support"
        title="Help is a message away."
        lead="Questions about your account, a subscription, Snookered Coach or something not working? Email us and a person will reply."
        strip={
          <Strip label="Support: email us" tag="Email">
            <span className="strip-name lower">support</span>
            <Sep />
            <span className="strip-dim lower hide-sm">snookeredapp.com</span>
          </Strip>
        }
      />
      <section className="section tight">
        <div className="wrap contact">
          <Reveal className="contact-card main dark">
            <span className="extra-icon on-dark">
              <Mail aria-hidden="true" strokeWidth={1.75} />
            </span>
            <h2 className="display-m">Get in touch</h2>
            <p>We aim to reply within two working days.</p>
            <a className="btn btn-primary" href={`mailto:${SUPPORT_EMAIL}?subject=Snookered%20support`}>
              {SUPPORT_EMAIL}
            </a>
          </Reveal>
          <Reveal delay={0.08} className="contact-card">
            <h2 className="display-m">Helps us help you</h2>
            <ul className="checks">
              {["The email address on your account", "Your phone model and iOS version", "What happened, and what you expected", "A screenshot, if you can"].map(
                (item) => (
                  <li key={item}>
                    <Check aria-hidden="true" strokeWidth={2.25} />
                    {item}
                  </li>
                )
              )}
            </ul>
          </Reveal>
        </div>
      </section>
      <section className="section alt">
        <div className="wrap narrow-grid">
          <Reveal className="section-head">
            <h2 className="display-l">Common questions.</h2>
          </Reveal>
          <Faq
            items={[
              {
                q: "I did not get my confirmation or reset email",
                a: (
                  <p>
                    Check your spam or junk folder for an email from Snookered (hello@snookeredapp.com). Links work once and expire after an
                    hour, so ask for a new one from the sign-in screen if it is old.
                  </p>
                ),
              },
              {
                q: "How do I delete my account?",
                a: (
                  <p>
                    In the app, go to Profile, then Settings, then Delete Account. It removes your account and its data. If you cannot sign
                    in, email us from the address on the account.
                  </p>
                ),
              },
              {
                q: "How do I cancel my subscription?",
                a: (
                  <p>
                    Subscriptions are managed by Apple: open Settings on your iPhone, tap your name, then Subscriptions. See{" "}
                    <Link to="/plans">Plans</Link> for more.
                  </p>
                ),
              },
              {
                q: "A friend's match is not showing on my profile",
                a: <p>Matches with a friend count for both players once the other player confirms the score. Ask them to check their match requests.</p>,
              },
              {
                q: "How do I report someone?",
                a: <p>Use Report on the message, group or routine. It goes to a person for review. For anything urgent, email us.</p>,
              },
              {
                q: "Where is my data kept?",
                a: (
                  <p>
                    See the <Link to="/privacy">Privacy Policy</Link> for what we collect, why, and the controls you have.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>
    </>
  );
}

function Legal({ title, intro, html }: { title: string; intro: string; html: string }) {
  return (
    <>
      <section className="page-hero legal-hero">
        <div className="wrap">
          <p className="eyebrow">Legal</p>
          <h1 className="display-l">{title}</h1>
          <p className="lead page-hero-lead">{intro}</p>
          <p className="updated">Last updated: September 2026</p>
        </div>
      </section>
      <section className="section tight">
        <div className="wrap">
          {/* Our own policy text, kept as HTML in src/content. */}
          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </section>
    </>
  );
}

export const Privacy = () => (
  <Legal title="Privacy Policy" intro="What data we collect, why we collect it, and the controls available to you." html={privacyHtml} />
);

export const Terms = () => (
  <Legal title="Terms of Use" intro="The terms for using Snookered. Please read them before you use the app." html={termsHtml} />
);

export function NotFound() {
  return (
    <section className="page-hero not-found">
      <div className="wrap">
        <p className="eyebrow">404</p>
        <h1 className="display-xl">In off.</h1>
        <p className="lead page-hero-lead">That page is not on the table. It may have moved, or the link may be wrong.</p>
        <Strip label="Foul: page not found" tag="Foul">
          <span className="strip-name">Page not found</span>
          <Sep />
          <span className="strip-num hide-sm">4</span>
        </Strip>
        <div className="not-found-actions">
          <Link className="btn btn-primary" to="/">
            Back to the home page <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
