import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string
      role?: string | null
      subscriptionStatus?: string | null
      aiCredits?: number | null
    } & DefaultSession['user']
  }
}
