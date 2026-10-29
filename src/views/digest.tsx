import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ data }: { data: Night }) {
  return (
    <>
      <h1>digest · {data.night}</h1>
      {data.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td class={r.retries >= 3 ? 'warn' : undefined}>{r.retries}</td>
                <td class={r.lastStatus === 'fail' ? 'warn' : undefined}>{r.lastStatus}</td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.badLines > 0 ? (
        <p class="mute">{data.badLines === 1 ? '1 line could not be read' : `${data.badLines} lines could not be read`}</p>
      ) : null}
    </>
  );
}

export function NoNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest</h1>
      <p class="mute">no run log for {night}</p>
    </>
  );
}
