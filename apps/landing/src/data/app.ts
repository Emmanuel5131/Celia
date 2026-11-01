/**
 * Where the buttons on this site lead. Reporting a loss goes to the full-page sign in of the Celia app, which also offers "Create
 * account". Professional access goes to the app's join page, which shows the fee and starts the application, so it never lands on
 * the sign in. Set `PUBLIC_APP_URL` to the app's address in production. Locally it is the app's dev server, and a production build
 * without it still points at the live app, so a missing setting never sends visitors to localhost.
 */
const fallback = import.meta.env.PROD ? 'https://trycelia.vercel.app' : 'http://localhost:3000';
const base = (import.meta.env.PUBLIC_APP_URL ?? fallback).replace(/\/$/u, '');

export const appLogin = `${base}/sign-in`;
export const appJoin = `${base}/join`;
