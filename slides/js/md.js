/*
 * A small Markdown subset for the slide sources in content/*.md. Trusted input: raw HTML passes through.
 *
 *   # ## ###        headings
 *   - item / 1.     lists (two spaces of indent nest)
 *   | a | b |       tables (second row is the separator)
 *   > quote         block quote
 *   ```lang         code; ```html is inserted as-is
 *   ::: class       a <div class="class"> until a line with only :::   (nests)
 *   @name args      a component placeholder, see deck.js
 *   [[ok:Đã chạy]]  a status pill (ok, wip, todo, road)
 *   `x` **b** *e* [t](u)   inline
 * A line starting with "<" begins a raw HTML block that runs to the next blank line.
 */
(function (root) {
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(esc(c)); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = s.replace(/\[\[(\w+):([^\]]+)\]\]/g, '<span class="pill $1">$2</span>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(>])\*([^*\s][^*]*?)\*(?=[\s).,;:<]|$)/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => "<code>" + codes[+i] + "</code>");
  }

  function cells(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  }

  function list(lines, i, indent) {
    // lines[i] is a list item at `indent`; consume the whole list, nesting deeper items
    const ordered = /^\s*\d+\.\s/.test(lines[i]);
    const tag = ordered ? "ol" : "ul";
    let html = "<" + tag + ">";
    const itemRe = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/;
    while (i < lines.length) {
      const m = itemRe.exec(lines[i]);
      if (!m || m[1].length < indent) break;
      if (m[1].length > indent) {
        const [sub, next] = list(lines, i, m[1].length);
        html = html.replace(/<\/li>$/, sub + "</li>");
        i = next;
        continue;
      }
      html += "<li>" + inline(m[2]) + "</li>";
      i++;
    }
    return [html + "</" + tag + ">", i];
  }

  function render(src) {
    const lines = src.replace(/\r/g, "").split("\n");
    const out = [];
    const stack = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      let m;
      if ((m = /^```(\w*)\s*$/.exec(line))) {
        const body = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push(m[1] === "html" ? body.join("\n") : "<pre><code>" + esc(body.join("\n")) + "</code></pre>");
      } else if ((m = /^:::\s*(.*)$/.exec(line))) {
        if (m[1].trim()) { out.push('<div class="' + esc(m[1].trim()) + '">'); stack.push(1); }
        else if (stack.length) { stack.pop(); out.push("</div>"); }
        i++;
      } else if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
        out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">");
        i++;
      } else if ((m = /^@(\w[\w-]*)\s*(.*)$/.exec(line))) {
        const args = {};
        (m[2].match(/[\w-]+=(?:"[^"]*"|\S+)/g) || []).forEach(a => {
          const k = a.slice(0, a.indexOf("="));
          args[k] = a.slice(k.length + 1).replace(/^"|"$/g, "");
        });
        out.push('<div class="comp" data-comp="' + m[1] + '" data-args="' + esc(JSON.stringify(args)).replace(/"/g, "&quot;") + '"></div>');
        i++;
      } else if (line.trim().startsWith("<")) {
        const body = [];
        while (i < lines.length && lines[i].trim() && !(body.length && /^(#{1,3}\s|:::|```|[-*]\s)/.test(lines[i]))) body.push(lines[i++]);
        out.push(body.join("\n"));
      } else if (/^\s*\|/.test(line)) {
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
        const head = cells(rows[0]);
        const body = rows.slice(/^\s*\|[\s:|-]+\|\s*$/.test(rows[1] || "") ? 2 : 1).map(cells);
        out.push("<table><thead><tr>" + head.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" +
          body.map(r => "<tr>" + r.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>");
      } else if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
        const [html, next] = list(lines, i, /^(\s*)/.exec(line)[1].length);
        out.push(html);
        i = next;
      } else if (line.startsWith(">")) {
        const body = [];
        while (i < lines.length && lines[i].startsWith(">")) body.push(lines[i++].replace(/^>\s?/, ""));
        out.push("<blockquote>" + inline(body.join(" ")) + "</blockquote>");
      } else if ((m = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line))) {
        out.push('<figure><img src="' + m[2] + '" alt="' + esc(m[1]) + '"></figure>');
        i++;
      } else {
        const body = [];
        while (i < lines.length && lines[i].trim() && !/^(```|:::|#{1,3}\s|@\w|\s*\|\s*|\s*(?:[-*]|\d+\.)\s|>)/.test(lines[i]) && !lines[i].trim().startsWith("<")) body.push(lines[i++].trim());
        if (!body.length) body.push(lines[i++].trim());   // never stall on a line no rule claims
        out.push("<p>" + body.map(inline).join("<br>") + "</p>");   // one idea per line: keep the line breaks
      }
    }
    while (stack.pop()) out.push("</div>");
    return out.join("\n");
  }

  root.md = { render, inline };
})(window);
