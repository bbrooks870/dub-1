import {
  addDomainToVercel,
  domainExists,
  validateDomain,
} from "#/lib/api/domains";
import { Session, withUserAuth } from "#/lib/auth";
import { isReservedKey } from "#/lib/edge-config";
import prisma from "#/lib/prisma";
import { DEFAULT_REDIRECTS, validSlugRegex } from "@dub/utils";
import { NextApiRequest, NextApiResponse } from "next";

export default withUserAuth(
  async (req: NextApiRequest, res: NextApiResponse, session: Session) => {
    // GET /api/projects – get all projects associated with the authenticated user
    if (req.method === "GET") {
      const response = await prisma.project.findMany({
        where: {
          users: {
            some: {
              userId: session.user.id,
            },
          },
        },
        include: {
          domains: true,
        },
      });
      return res.status(200).json(response);

      // POST /api/projects – create a new project
    } else if (req.method === "POST") {
      const { name, slug, domain } = req.body;
      if (!name || !slug || !domain) {
        return res
          .status(422)
          .json({ error: "Missing name or slug or domain" });
      }
      let slugError: string | null = null;

      // check if slug is too long
      if (slug.length > 48) {
        slugError = "Slug must be less than 48 characters";

        // check if slug is valid
      } else if (!validSlugRegex.test(slug)) {
        slugError = "Invalid slug";

        // check if slug is reserved
      } else if ((await isReservedKey(slug)) || DEFAULT_REDIRECTS[slug]) {
        slugError = "Cannot use reserved slugs";
      }

      const validDomain = await validateDomain(domain);
      if (slugError || validDomain !== true) {
        return res.status(422).json({
          slugError,
          domainError: validDomain === true ? null : validDomain,
        });
      }
      const [slugExist, domainExist] = await Promise.all([
        prisma.project.findUnique({
          where: {
            slug,
          },
          select: {
            slug: true,
          },
        }),
        domainExists(domain),
      ]);
      if (slugExist || domainExist) {
        return res.status(422).json({
          slugError: slugExist ? "Slug is already in use." : null,
          domainError: domainExist ? "Domain is already in use." : null,
        });
      }
      const response = await Promise.allSettled([
        prisma.project.create({
          data: {
            name,
            slug,
            users: {
              create: {
                userId: session.user.id,
                role: "owner",
              },
            },
            domains: {
              create: {
                slug: domain,
                primary: true,
              },
            },
            billingCycleStart: new Date().getDate(),
          },
        }),
        addDomainToVercel(domain),
      ]);

      return res.status(200).json(response);
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  },
);
