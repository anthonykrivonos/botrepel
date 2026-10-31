// Opt-in: fetching skills from the network on every install is a supply-chain risk.
if (process.env.BOTREPEL_SKILLS_UPDATE === "1" && !process.env.CI && !process.env.VERCEL) {
  try {
    const update = Bun.spawn([process.execPath, "run", "skills:update"], {
      cwd: `${import.meta.dir}/..`,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    if ((await update.exited) !== 0) {
      process.stderr.write("Skills refresh failed. Dependencies are installed; retry with bun run skills:update.\n");
    }
  } catch {
    process.stderr.write("Skills refresh could not start. Retry with bun run skills:update.\n");
  }
}
