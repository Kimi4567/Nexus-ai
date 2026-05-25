import NextAuth, { type NextAuthOptions, type Session } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"
import type { JWT } from "next-auth/jwt"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Implement proper password hashing with bcrypt in production
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          throw new Error("User not found")
        }

        // TODO: Implement bcrypt verification
        // const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash || "")
        // if (!passwordValid) throw new Error("Invalid password")

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        } as any
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || ""
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub || "" },
          select: {
            role: true,
            subscriptionStatus: true,
            aiCredits: true,
          },
        })
        if (dbUser) {
          (session.user as any).role = dbUser.role;
          (session.user as any).subscriptionStatus = dbUser.subscriptionStatus;
          (session.user as any).aiCredits = dbUser.aiCredits;
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
    newUser: "/onboarding",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
}

export default NextAuth(authOptions)
