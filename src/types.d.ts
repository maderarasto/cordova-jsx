type JSX = {
  elementName: Function | string
  attributes: Record<string, any>
  children: (JSX | string)[]
}

type FunctionComponent = () => JSX | string

type AppConfig = {
  mountEl: HTMLElement | string
  render: FunctionComponent
}