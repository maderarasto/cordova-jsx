type JSX = {
  elementName: Function | string
  attributes: Record<string, any>
  children: (JSX | string)[]
}

type RenderResult = JSX | JSX[] | string
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
  parent: Object
  nodeRef: Object
  position: number
  elementRef: HTMLElement|null
  oldProps?: Record<string, any>
  newProps?: Record<string, any>
}

type PropDiff = {
  type: 'Add' | 'Update' | 'Remove'
  name: string
  value?: any
}

type AppConfig = {
  mountEl: HTMLElement | string
  render: RenderCallback
}