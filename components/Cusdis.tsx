import { QuartzComponent, QuartzComponentProps } from "./types"

const Cusdis: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const pageId = fileData.slug ?? "index"
  const pageUrl = `https://a11ylab.kr/${pageId}`
  const pageTitle = fileData.frontmatter?.title ?? pageId

  return (
    <div
      id="cusdis_thread"
      data-host="https://your-cusdis-host.com"  // self-host URL 또는 https://cusdis.com
      data-app-id="YOUR_APP_ID"
      data-page-id={pageId}
      data-page-url={pageUrl}
      data-page-title={pageTitle}
      dangerouslySetInnerHTML={{ __html: "" }}
    />
  )
}

Cusdis.afterDOMLoaded = `
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cusdis.com/js/cusdis.es.js';  // self-host 시 경로 변경
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  })();
`

export default Cusdis
