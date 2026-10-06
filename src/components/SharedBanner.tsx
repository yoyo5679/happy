export function SharedBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="shared-banner">
      <span>📩 공유받은 결과예요. 상태가 달라졌다면 직접 다시 확인해 보세요.</span>
      <button className="btn" onClick={onRetry}>
        직접 해보기
      </button>
    </section>
  );
}
