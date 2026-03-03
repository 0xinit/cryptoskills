import type { MetadataRoute } from "next";
import { getAllSkills } from "@/lib/registry";

const BASE_URL = "https://cryptoskills.sh";

export default function sitemap(): MetadataRoute.Sitemap {
  const skills = getAllSkills();

  const skillPages: MetadataRoute.Sitemap = skills.map((skill) => ({
    url: `${BASE_URL}/skills/${skill.name}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...skillPages,
  ];
}
