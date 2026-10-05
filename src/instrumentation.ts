export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { resumeAll } = await import("./lib/pipeline");
    const { startMaintenance } = await import("./lib/maintenance");
    resumeAll();
    startMaintenance();
  }
}
