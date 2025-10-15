type JSX = {
  elementName: Function | string
  attributes: Record<string, any>
  children: (JSX | string)[]
}

type RenderResult = JSX | string
type RenderCallback = () => RenderResult

type RenderNodeType = (
  | 'root'
  | 'component'
  | 'element'
  | 'text'
)

type RenderNodeTag = string | RenderCallback
type RenderNodeProps = Record<string, any>

type AppConfig = {
  mountEl: HTMLElement | string
  render: RenderCallback
}