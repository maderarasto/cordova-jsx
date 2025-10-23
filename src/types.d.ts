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

type RenderNodeEffect = (
  | ''
  | 'Placement'
  | 'Update'
  | 'Deletion'
)

type RenderNodeTag = string | RenderCallback
type RenderNodeProps = Record<string, any>

type RenderChange = {
  effect: RenderNodeEffect
  parent: RenderNode|null
  nodeRef: RenderNode~
  position: number
  elementRef: HTMLElement|null
}

type AppConfig = {
  mountEl: HTMLElement | string
  render: RenderCallback
}