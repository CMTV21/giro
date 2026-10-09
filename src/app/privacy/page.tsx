import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="Giro helps you plan trips. This policy explains what personal information we collect, why, who we share it with, and the choices you have. We follow the principles of Canada's Personal Information Protection and Electronic Documents Act (PIPEDA).">
      <h2>1. What we collect</h2>
      <h3>When you create an account</h3>
      <ul>
        <li>Your name and email address.</li>
        <li>Your password, stored only as a salted, one-way hash. We can't see it.</li>
        <li>Optional preferences: home currency and home airport.</li>
      </ul>
      <h3>When you use Giro</h3>
      <ul>
        <li><strong>Trips</strong>: destinations, dates, party size, budget, interests, notes, and any edits you make.</li>
        <li><strong>Group trips</strong>: who is on a trip and their role, votes on activities, and shared expenses (amount, description, who paid and who it&apos;s split between). These are visible to everyone on that trip.</li>
        <li><strong>Travel DNA</strong>: a taste profile derived from what you swap, remove, book and vote on. You can view and reset it on your account page.</li>
        <li><strong>Partner clicks</strong>: when you follow a booking link, we record which partner, the trip, an estimated trip value, the time, and your account if you&apos;re signed in. This is how we earn and reconcile commissions.</li>
        <li><strong>Security data</strong>: your IP address, used to limit repeated sign-in, sign-up and reset attempts. These records are deleted within about a day.</li>
      </ul>
      <h3>When you don&apos;t sign in</h3>
      <p>Trips, preferences and packing checklists are kept in your browser&apos;s local storage on your device. They aren&apos;t sent to us unless you create an account, at which point they move into it.</p>
      <h3>What we don&apos;t collect</h3>
      <p>We don&apos;t take payments or store card details; bookings happen on our partners&apos; sites. We don&apos;t collect your precise location, and we don&apos;t sell personal information.</p>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To provide Giro: planning, saving and syncing trips, group features, and account emails (confirmation, password reset, invites you send).</li>
        <li>To personalise suggestions using your Travel DNA.</li>
        <li>To keep Giro secure and prevent abuse.</li>
        <li>To measure which partners are useful and to earn commissions that keep Giro free.</li>
        <li>To improve the product, using aggregated information wherever possible.</li>
      </ul>
      <p>We only use your information for these purposes, or for others you consent to or that the law permits.</p>

      <h2>3. Giro AI</h2>
      <p>If you turn on Giro AI, the trip details you enter (destinations, dates, party size, budget, interests, must-sees, things to avoid, and notes) are sent to Anthropic, our AI provider, to generate your itinerary. Please don&apos;t put sensitive personal information (such as health details) in notes. Giro AI is optional; the standard planner runs without it.</p>

      <h2>4. Who we share it with</h2>
      <p>We use trusted service providers to run Giro. They may only use your information to provide their service to us:</p>
      <ul>
        <li><strong>Vercel</strong>: website hosting.</li>
        <li><strong>Neon</strong>: database hosting.</li>
        <li><strong>Anthropic</strong>: Giro AI, only when you use it.</li>
        <li><strong>Resend</strong>: sending account and invite emails.</li>
        <li><strong>Open-Meteo</strong> and <strong>Frankfurter</strong>: weather forecasts and exchange rates. We send only a city or location and currency codes, never your personal information.</li>
      </ul>
      <p><strong>Travel partners.</strong> When you follow a booking link, you leave Giro for the partner&apos;s site (e.g. Booking.com, Expedia, Airbnb, Google Flights). The link includes your search details (destination, dates, party size, currency) and, for some partners, a click reference code, but not your name or email. The partner&apos;s own privacy policy applies from there.</p>
      <p><strong>Other members of your trips</strong> can see your name, votes and the expenses you add on those trips.</p>
      <p>We may also disclose information if required by law, or to protect the safety, rights or property of our users or the public.</p>

      <h2>5. Where your information is stored</h2>
      <p>Our service providers store and process information in the United States, so it may be accessible to authorities there under U.S. law.</p>

      <h2>6. Cookies and local storage</h2>
      <p>We use one essential cookie, <code>giro_session</code>, to keep you signed in. We don&apos;t use advertising or third-party tracking cookies. Your browser&apos;s local storage holds trips (when signed out), your Travel DNA and packing checklists. Partner sites may set their own cookies after you visit them.</p>

      <h2>7. How long we keep it</h2>
      <p>We keep your account information until you delete your account. Deleting it (Account → Delete account) permanently removes your profile, the trips you own (including for other members of those trips), your trip memberships, votes, expenses you paid, and sessions. Partner click records are kept for commission reconciliation, but are no longer linked to you. Our database provider may hold encrypted backups for a short period before they expire.</p>

      <h2>8. Your choices and rights</h2>
      <ul>
        <li><strong>Access and correction</strong>: view and edit your profile on the account page, or ask us for a copy of your information.</li>
        <li><strong>Deletion</strong>: delete your account at any time from the account page.</li>
        <li><strong>Withdraw consent</strong>: stop using Giro AI, reset your Travel DNA, or delete your account.</li>
        <li><strong>Complaints</strong>: contact us first. You can also complain to the <a href="https://www.priv.gc.ca/" rel="noopener noreferrer">Office of the Privacy Commissioner of Canada</a>.</li>
      </ul>

      <h2>9. Security</h2>
      <p>We protect your information with encrypted connections (HTTPS), hashed passwords and session tokens, access controls on trips, and rate limits on sensitive actions. No system is perfectly secure, so please use a unique password.</p>

      <h2>10. Age</h2>
      <p>You must have reached the age of majority in your province or territory to create an account. Adults may include children on trips they plan.</p>

      <h2>11. Changes</h2>
      <p>If we make material changes to this policy, we&apos;ll update the date above and, where appropriate, let you know by email or in the app.</p>

      <h2>12. Contact</h2>
      <p>Questions or requests about privacy: <Contact />.</p>
    </LegalPage>
  );
}
