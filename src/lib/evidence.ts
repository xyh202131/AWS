export const hideAgentParameters = (text: string) =>
  text
    .replace(/Adaptive weights:\s*C\d+\/N\d+\/P\d+\/U\d+\/I\d+;\s*risk penalty \d+\.?/gi, "Agent parameter profile locked.")
    .replace(/\bC\d+\/N\d+\/P\d+\/U\d+\/I\d+\b/g, "agent parameter profile");
