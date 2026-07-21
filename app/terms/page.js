export const metadata = {
  title: 'Terms of Service — DesiHawas',
  description: 'Terms of Service and Adult Content Policy for DesiHawas platform.',
};

export default function TermsPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0d0d15',
      color: '#f1f5f9',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>📋</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8,
            background: 'linear-gradient(135deg,#a78bfa,#818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Terms of Service
          </h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Last updated: July 2025 · DesiHawas Platform</p>
        </div>

        {/* Warning */}
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 16, padding: '20px 24px', marginBottom: 36 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f87171', marginBottom: 8 }}>🔞 Adult Content Warning</h2>
          <p style={{ fontSize: 14, color: '#fca5a5', lineHeight: 1.7, margin: 0 }}>
            This website contains adult content intended for individuals aged 18 and above. By accessing this site, you confirm that you are at least 18 years of age and that adult content is legal in your jurisdiction. If you are under 18 years of age, you are prohibited from accessing this website.
          </p>
        </div>

        {/* Sections */}
        {[
          {
            title: '1. Acceptance of Terms',
            content: `By accessing and using DesiHawas ("the Platform"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform. These terms apply to all visitors, users, and others who access or use the service.`,
          },
          {
            title: '2. Age Verification',
            content: `You must be at least 18 years of age to use this Platform. By using this site, you represent and warrant that you are 18 years of age or older and that you have the legal right to access adult content in your jurisdiction. We are not responsible for false declarations of age made by users.`,
          },
          {
            title: '3. Disclaimer of Responsibility',
            content: `DesiHawas acts as a platform for content aggregation and user-generated material. We are NOT responsible for the accuracy, legality, or appropriateness of any content uploaded, shared, or linked through the Platform. All videos, images, and materials on this Platform are provided for entertainment purposes only. We make no warranties regarding the content's origin, ownership, or copyright status.`,
          },
          {
            title: '4. Content Policy',
            content: `All content displayed on DesiHawas is intended for adults only. We do not host or store video files on our servers; all content is streamed from third-party cloud storage services. We do not knowingly allow illegal content. If you believe any content violates laws or rights, please use the Report button. We reserve the right to remove any content at our discretion.`,
          },
          {
            title: '5. No Child Exploitation Policy',
            content: `DesiHawas has a ZERO TOLERANCE policy towards child sexual abuse material (CSAM) or any content that exploits, abuses, or endangers minors. Any such content, if discovered, will be immediately removed and reported to appropriate law enforcement authorities. Users who upload, share, or promote such content will be permanently banned.`,
          },
          {
            title: '6. User Accounts',
            content: `You are responsible for maintaining the confidentiality of your account credentials. You agree not to share your account with others. We reserve the right to suspend or terminate accounts that violate these terms. Premium subscriptions are non-refundable once activated. Account sharing is strictly prohibited and may result in permanent ban.`,
          },
          {
            title: '7. Premium Subscriptions',
            content: `Premium plans are sold as-is with no guaranteed uptime. Subscriptions are non-transferable and non-refundable. We reserve the right to modify, suspend, or discontinue any premium feature at any time. In case of server downtime exceeding 72 hours, we may offer account extensions at our discretion.`,
          },
          {
            title: '8. Device Limits',
            content: `Free accounts are limited to accessing the platform from a limited number of devices. Premium accounts receive expanded device access. Sharing accounts or using VPNs/proxies to bypass device limits is prohibited and may result in account termination.`,
          },
          {
            title: '9. Intellectual Property',
            content: `The DesiHawas name, logo, and platform design are our intellectual property. You may not reproduce, distribute, or create derivative works without our express written permission. Content on the platform belongs to its respective owners; DesiHawas claims no ownership of user-uploaded content.`,
          },
          {
            title: '10. Limitation of Liability',
            content: `DesiHawas and its operators are NOT liable for any damages arising from the use of this Platform, including but not limited to data loss, device damage, emotional distress, or financial loss. We are not responsible for third-party links, content, or services. Use this Platform at your own risk.`,
          },
          {
            title: '11. Privacy & Cookies',
            content: `We collect minimal user data including username, email (optional), and session information for authentication purposes. We use cookies to maintain your login session and preferences. We do not sell your personal data to third parties. For more information, contact our support team.`,
          },
          {
            title: '12. Governing Law',
            content: `These terms are governed by applicable laws. By using this Platform, you consent to resolve any disputes through good-faith negotiation. If legal proceedings are necessary, both parties agree to use appropriate legal channels in the applicable jurisdiction.`,
          },
          {
            title: '13. Changes to Terms',
            content: `We reserve the right to update these Terms of Service at any time. Continued use of the Platform after changes constitutes acceptance of the new terms. We recommend checking these terms periodically.`,
          },
          {
            title: '14. Contact',
            content: `For questions, concerns, or DMCA takedown requests, please use the Report button on individual videos or contact us through our support channels. We aim to respond to all legitimate inquiries within 48 hours.`,
          },
        ].map(section => (
          <div key={section.title} style={{
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa', marginBottom: 10 }}>{section.title}</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.8, margin: 0 }}>{section.content}</p>
          </div>
        ))}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, padding: '24px', background: 'rgba(124,58,237,.08)', borderRadius: 16, border: '1px solid rgba(124,58,237,.2)' }}>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            By using DesiHawas, you acknowledge that you have read, understood, and agreed to these Terms of Service.
          </p>
          <a href="/gallery" style={{ display: 'inline-block', marginTop: 16, padding: '12px 32px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
            ← Back to Gallery
          </a>
        </div>
      </div>
    </main>
  );
}
