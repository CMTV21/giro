import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Affiliate Disclosure" };

export default function DisclosurePage() {
  return (
    <LegalPage title="Affiliate Disclosure" intro="Giro is free to use. We keep it that way by earning commissions from some of the travel companies we link to. Here's how that works.">
      <h2>How Giro earns money</h2>
      <p>When you click certain booking links in Giro and then make a booking, the partner may pay Giro a commission. <strong>You pay nothing extra</strong>: the price is the same as booking with the partner directly.</p>

      <h2>Commissions don&apos;t decide your itinerary</h2>
      <p>Giro chooses the places in your plan based on your interests, budget, pace, party and travel dates. Whether a partner pays us is not part of how activities, neighbourhoods or destinations are chosen or ranked. We also include useful links that pay us nothing, such as Google Flights and Airbnb, because they help you plan.</p>

      <h2>Partners</h2>
      <p>Depending on our active agreements, Giro may earn commissions from programs including Booking.com, Expedia Group (Expedia, Vrbo), GetYourGuide, Viator, Skyscanner and KAYAK. Links to Google Flights, Google Maps and Airbnb don&apos;t earn us a commission.</p>

      <h2>How we track referrals</h2>
      <p>Booking links pass through a short Giro redirect that records the click, so we can match commissions to trips. Some links include a reference code for the partner. We don&apos;t share your name or email with partners through these links. See our Privacy Policy for details.</p>

      <h2>Questions</h2>
      <p>Contact <Contact />.</p>
    </LegalPage>
  );
}
