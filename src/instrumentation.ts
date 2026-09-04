export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Deferred import: instrumentation.ts loads before most of the app, and
    // this module touches Prisma — importing it eagerly at the top would pull
    // the whole dependency graph in earlier than necessary.
    import("@/lib/whatsapp/worker").then((m) => m.startWhatsAppWorker());
    // Resumes any school's live WhatsApp Web connection using saved
    // credentials — otherwise a server restart would silently leave sends
    // failing until an admin happened to revisit the Connect screen.
    import("@/lib/whatsapp/baileys-provider").then((m) => m.resumeBaileysConnections());
    import("@/lib/email-campaigns/worker").then((m) => m.startEmailWorker());
  }
}
