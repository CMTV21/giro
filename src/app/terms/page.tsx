import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" intro="These terms govern your use of Giro. By using Giro or creating an account, you agree to them. If you don't agree, please don't use Giro.">
      <h2>1. What Giro is (and isn&apos;t)</h2>
      <p>Giro is a trip-planning tool. It suggests itineraries, estimates costs and links you to third-party sites where you can book. <strong>Giro is not a travel agency and doesn&apos;t sell travel.</strong> When you book through a partner (such as Booking.com, Expedia, Airbnb or an airline), your contract is with that partner, and their terms, prices, cancellation rules and customer service apply.</p>

      <h2>2. Plans, prices and AI suggestions</h2>
      <ul>
        <li>Prices, fares, exchange rates, weather and budgets shown in Giro are <strong>estimates</strong>. Actual prices and availability are set by partners and can change at any time.</li>
        <li>Itineraries, including those created by Giro AI, may contain mistakes or outdated information (for example opening hours, closures, prices or travel times). Always confirm important details before you travel.</li>
        <li>You&apos;re responsible for your own travel decisions, including passports, visas, health requirements, insurance and safety. Check the Government of Canada&apos;s <a href="https://travel.gc.ca/" rel="noopener noreferrer">travel advice and advisories</a> before you go.</li>
      </ul>

      <h2>3. Your account</h2>
      <p>You must have reached the age of majority in your province or territory to create an account. Keep your password secure; you&apos;re responsible for activity on your account. Tell us if you think your account has been compromised.</p>

      <h2>4. Group trips and shared expenses</h2>
      <p>Trip owners decide who can view or edit a trip. Shared expense tracking is a record-keeping convenience: Giro doesn&apos;t move money, and the balances shown are only as accurate as what members enter.</p>

      <h2>5. Your content</h2>
      <p>You own the trips, notes and other content you create. You give Giro a licence to store, process and display that content as needed to run the service, including showing it to members of trips you share. Don&apos;t post anything unlawful, abusive, or that infringes someone else&apos;s rights.</p>

      <h2>6. Acceptable use</h2>
      <p>Don&apos;t misuse Giro. For example, don&apos;t send spam invites, try to access others&apos; trips or accounts without permission, interfere with the service, overload it, or scrape it with automated tools. We may suspend accounts that do.</p>

      <h2>7. Commissions</h2>
      <p>Giro may earn a commission when you book through some links, at no extra cost to you. See our <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>.</p>

      <h2>8. Third-party sites</h2>
      <p>Giro links to sites we don&apos;t control. We aren&apos;t responsible for their content, products, services or privacy practices.</p>

      <h2>9. Giro&apos;s intellectual property</h2>
      <p>The Giro name, logo, design, software and curated content belong to Giro or its licensors. You may use Giro for personal, non-commercial trip planning.</p>

      <h2>10. Disclaimers and limitation of liability</h2>
      <p>Giro is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent permitted by law, we disclaim warranties of any kind, and we aren&apos;t liable for indirect or consequential losses, or for losses arising from bookings with third parties, travel disruptions, or reliance on estimates or suggestions. Nothing in these terms limits rights you have under consumer protection laws that can&apos;t be waived.</p>

      <h2>11. Ending your use</h2>
      <p>You can delete your account at any time. We may suspend or end access if you breach these terms or if we discontinue the service.</p>

      <h2>12. Changes</h2>
      <p>We may update these terms. We&apos;ll change the date above and, for material changes, notify you. Continuing to use Giro means you accept the updated terms.</p>

      <h2>13. Governing law</h2>
      <p>These terms are governed by the laws of Canada and of the province in which Giro&apos;s operator is based, without regard to conflict-of-law rules.</p>

      <h2>14. Contact</h2>
      <p>Questions about these terms: <Contact />.</p>
    </LegalPage>
  );
}
