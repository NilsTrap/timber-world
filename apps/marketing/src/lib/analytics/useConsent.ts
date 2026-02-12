"use client";

import { useState, useEffect, useCallback } from "react";

const CONSENT_KEY = "tw_analytics_consent";
const SESSION_KEY = "tw_analytics_session";
const SESSION_EXPIRY_MS = 30 * 60 * 1000;

export type ConsentStatus = "pending" | "accepted" | "rejected";

interface ConsentState {
  status: ConsentStatus;
  timestamp: number;
}

interface SessionData {
  id: string;
  expiresAt: number;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function getOrCreateSession(): string {
  if (typeof window === "undefined") return "";

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const data: SessionData = JSON.parse(stored);
      if (data.expiresAt > Date.now()) {
        return data.id;
      }
    }

    const newSession: SessionData = {
      id: generateSessionId(),
      expiresAt: Date.now() + SESSION_EXPIRY_MS,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    return newSession.id;
  } catch {
    return generateSessionId();
  }
}

// Track consent decision directly (bypasses normal analytics flow)
function trackConsentDecision(decision: "accepted" | "rejected"): void {
  if (typeof window === "undefined") return;

  const sessionId = getOrCreateSession();
  if (!sessionId) return;

  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      eventName: "consent_decision",
      eventCategory: "consent",
      properties: { decision },
      pagePath: window.location.pathname,
      locale: document.documentElement.lang,
      referrer: document.referrer,
    }),
    keepalive: true,
  }).catch(() => {
    // Silently fail
  });
}

export function useConsent() {
  const [consent, setConsent] = useState<ConsentStatus>("pending");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load consent from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored) {
        const data: ConsentState = JSON.parse(stored);
        setConsent(data.status);
      }
    } catch {
      // Invalid stored data, treat as pending
    }
    setIsLoaded(true);
  }, []);

  const acceptConsent = useCallback(() => {
    const state: ConsentState = {
      status: "accepted",
      timestamp: Date.now(),
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    setConsent("accepted");
    trackConsentDecision("accepted");
  }, []);

  const rejectConsent = useCallback(() => {
    // Track the rejection BEFORE clearing session
    trackConsentDecision("rejected");

    const state: ConsentState = {
      status: "rejected",
      timestamp: Date.now(),
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    setConsent("rejected");

    // Clear any existing analytics session
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(CONSENT_KEY);
    sessionStorage.removeItem("tw_analytics_session");
    setConsent("pending");
  }, []);

  return {
    consent,
    isLoaded,
    hasConsented: consent === "accepted",
    isPending: consent === "pending",
    acceptConsent,
    rejectConsent,
    resetConsent,
  };
}
