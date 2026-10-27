import type { ConsentSection } from "@/data/consent";

/** 동의 항목 표 (웹 동의 · 인쇄용 동의서 공용) */
export function ConsentTable({ section }: { section: ConsentSection }) {
  return (
    <table className="consent-table">
      <tbody>
        {section.rows.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
