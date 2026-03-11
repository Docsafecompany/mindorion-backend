export function generateHtmlReport(report: any, fileName: string): string {
    const date = new Date().toLocaleString('fr-FR', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const operations: string[] = report.operations || [];
    const removedItems: number = report.removedItems || 0;

  const operationRows = operations.length > 0
      ? operations.map(op => {
                const lower = op.toLowerCase();
                let color = '#4a90d9';
                if (lower.includes('comment')) color = '#e67e22';
                else if (lower.includes('track')) color = '#8e44ad';
                else if (lower.includes('hidden') || lower.includes('speaker')) color = '#c0392b';
                else if (lower.includes('sensitive') || lower.includes('redact')) color = '#e74c3c';
                else if (lower.includes('spelling')) color = '#27ae60';
                else if (lower.includes('embedded')) color = '#16a085';
                return `<tr>
                          <td style="color:${color};font-size:1.1em;width:28px;padding:10px 8px;">&#10003;</td>
                                    <td style="padding:10px 8px;font-size:0.9em;border-bottom:1px solid #f0f0f0;">${escapeHtml(op)}</td>
                                            </tr>`;
      }).join('')
        : '<tr><td colspan="2" style="padding:12px;color:#aaa;font-style:italic;">No cleaning operations performed.</td></tr>';

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <title>Mindorion Sanitization Report</title>
          <style>
              *{box-sizing:border-box;margin:0;padding:0}
                  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;color:#2c3e50;padding:32px 16px}
                      .wrap{max-width:800px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
                          .hdr{background:linear-gradient(135deg,#1a1a2e,#2c3e50);color:#fff;padding:28px 32px}
                              .hdr .logo{font-size:1.3em;font-weight:800;margin-bottom:8px}.logo-dot{color:#4a90d9}
                                  .hdr h1{font-size:1.5em;font-weight:700;margin-bottom:4px}
                                      .hdr .sub{opacity:.7;font-size:.87em}
                                          .card{background:#fff;padding:24px 32px;border-bottom:1px solid #eaecef}
                                              .card:last-child{border-bottom:none}
                                                  .card h2{font-size:1.05em;font-weight:600;color:#1a1a2e;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #f0f0f0}
                                                      .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px}
                                                          .stat{background:#f8f9fa;border:1px solid #eaecef;border-radius:8px;padding:16px;text-align:center}
                                                              .stat-v{font-size:2.2em;font-weight:700;color:#4a90d9;line-height:1}
                                                                  .stat-l{font-size:.75em;color:#6c757d;margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
                                                                      .kv{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;font-size:.9em}
                                                                          .kv .k{color:#6c757d;font-weight:500}.kv .v{color:#2c3e50;word-break:break-all}
                                                                              table{width:100%;border-collapse:collapse}
                                                                                  .ok{display:inline-flex;align-items:center;gap:6px;background:#d4edda;color:#155724;padding:8px 16px;border-radius:6px;font-size:.9em;font-weight:600;margin-top:4px}
                                                                                      footer{text-align:center;color:#aaa;font-size:.78em;padding:16px 32px;background:#fff}
                                                                                        </style>
                                                                                        </head>
                                                                                        <body>
                                                                                        <div class="wrap">
                                                                                          <div class="hdr">
                                                                                              <div class="logo">Mindorion<span class="logo-dot">.</span></div>
                                                                                                  <h1>Document Sanitization Report</h1>
                                                                                                      <div class="sub">Generated on ${escapeHtml(date)}</div>
                                                                                                        </div>
                                                                                                        
                                                                                                          <div class="card">
                                                                                                              <h2>Document Information</h2>
                                                                                                                  <div class="kv">
                                                                                                                        <span class="k">File name</span><span class="v">${escapeHtml(fileName)}</span>
                                                                                                                              <span class="k">Processed at</span><span class="v">${escapeHtml(date)}</span>
                                                                                                                                    <span class="k">Engine</span><span class="v">Mindorion Document Intelligence v1.0</span>
                                                                                                                                        </div>
                                                                                                                                          </div>
                                                                                                                                          
                                                                                                                                            <div class="card">
                                                                                                                                                <h2>Cleaning Summary</h2>
                                                                                                                                                    <div class="grid3">
                                                                                                                                                          <div class="stat"><div class="stat-v">${operations.length}</div><div class="stat-l">Operations</div></div>
                                                                                                                                                                <div class="stat"><div class="stat-v">${removedItems}</div><div class="stat-l">Items Cleaned</div></div>
                                                                                                                                                                      <div class="stat"><div class="stat-v" style="color:${removedItems > 0 ? '#27ae60' : '#aaa'}">${removedItems > 0 ? '&#10003;' : '&mdash;'}</div><div class="stat-l">Status</div></div>
                                                                                                                                                                          </div>
                                                                                                                                                                              ${removedItems > 0 ? '<div class="ok">&#10003; Document successfully sanitized</div>' : ''}
                                                                                                                                                                                </div>
                                                                                                                                                                                
                                                                                                                                                                                  <div class="card">
                                                                                                                                                                                      <h2>Cleaning Operations</h2>
                                                                                                                                                                                          <table><tbody>${operationRows}</tbody></table>
                                                                                                                                                                                            </div>
                                                                                                                                                                                            
                                                                                                                                                                                              <footer>Mindorion Document Intelligence Engine &mdash; ${escapeHtml(date)}</footer>
                                                                                                                                                                                              </div>
                                                                                                                                                                                              </body>
                                                                                                                                                                                              </html>`;
}

function escapeHtml(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
