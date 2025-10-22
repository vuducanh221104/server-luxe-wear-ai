/**
 * @file passport.ts
 * @description Passport.js configuration for OAuth authentication
 * Supports Google OAuth 2.0 and GitHub OAuth
 */

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from "passport-github2";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";
import logger from "./logger";
import { User } from "../types/user";

/**
 * Google OAuth Strategy
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          logger.info("Google OAuth callback", {
            profileId: profile.id,
            email: profile.emails?.[0]?.value,
          });

          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Google profile"), undefined);
          }

          // Check if user exists
          let user = await authService.getUserByEmail(email);

          if (user) {
            // User exists, update profile if needed
            logger.info("Existing user found", { userId: user.id, email });

            // Update user's last login
            await authService.updateUser(user.id, {
              last_login: new Date().toISOString(),
            });
          } else {
            // Create new user from Google profile
            logger.info("Creating new user from Google profile", { email });

            const registerResult = await authService.register({
              email,
              name: profile.displayName || email.split("@")[0],
              password: Math.random().toString(36).slice(-12) + "Aa1!", // Random strong password
            });

            user = registerResult.user;

            logger.info("New user created from Google OAuth", { userId: user.id, email });
          }

          return done(null, user);
        } catch (error) {
          logger.error("Google OAuth error", {
            error: error instanceof Error ? error.message : "Unknown error",
            profileId: profile.id,
          });
          return done(error as Error, undefined);
        }
      }
    )
  );

  logger.info("Google OAuth strategy initialized");
} else {
  logger.warn("Google OAuth credentials not found. Google login will be disabled.");
}

/**
 * GitHub OAuth Strategy
 */
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || "/api/auth/github/callback",
        scope: ["user:email"],
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: GitHubProfile,
        done: (error: Error | null, user?: User | false) => void
      ) => {
        try {
          logger.info("GitHub OAuth callback", {
            profileId: profile.id,
            username: profile.username,
          });

          // GitHub may not provide email in profile, get from emails array
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in GitHub profile"), undefined);
          }

          // Check if user exists
          let user = await authService.getUserByEmail(email);

          if (user) {
            // User exists, update profile if needed
            logger.info("Existing user found", { userId: user.id, email });

            // Update user's last login
            await authService.updateUser(user.id, {
              last_login: new Date().toISOString(),
            });
          } else {
            // Create new user from GitHub profile
            logger.info("Creating new user from GitHub profile", { email });

            const registerResult = await authService.register({
              email,
              name: profile.displayName || profile.username || email.split("@")[0],
              password: Math.random().toString(36).slice(-12) + "Aa1!", // Random strong password
            });

            user = registerResult.user;

            logger.info("New user created from GitHub OAuth", { userId: user.id, email });
          }

          return done(null, user);
        } catch (error) {
          logger.error("GitHub OAuth error", {
            error: error instanceof Error ? error.message : "Unknown error",
            profileId: profile.id,
          });
          return done(error as Error, undefined);
        }
      }
    )
  );

  logger.info("GitHub OAuth strategy initialized");
} else {
  logger.warn("GitHub OAuth credentials not found. GitHub login will be disabled.");
}

/**
 * Serialize user for session
 * (Not used in JWT auth, but required by Passport)
 */
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as User).id);
});

/**
 * Deserialize user from session
 * (Not used in JWT auth, but required by Passport)
 */
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userService.getUserProfile(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
