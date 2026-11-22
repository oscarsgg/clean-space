import { NextResponse } from 'next/server'

export async function DELETE() {
  const response = new NextResponse(null, { status: 204 })
  const cookieOptions = { path: '/', domain: process.env.COOKIE_DOMAIN || undefined, maxAge: 0 }
  response.cookies.set('cleanspace_route_session', '', cookieOptions)
  response.cookies.set('refresh_token', '', cookieOptions)
  return response
}
