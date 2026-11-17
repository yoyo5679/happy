"use client";

import { useEffect } from "react";

/** 앱(TWA)·홈 화면 설치용 서비스워커 등록. 인터넷이 끊겼을 때 안내 화면만 보여 줌 (public/sw.js) */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || location.hostname === "localhost") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
