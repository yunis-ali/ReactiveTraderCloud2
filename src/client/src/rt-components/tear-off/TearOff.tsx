import React, { useCallback, useRef, useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import ExternalWindow, { ExternalWindowProps } from './ExternalWindow'
import styled from 'styled-components/macro'
import { useDispatch } from 'react-redux'
import { usePlatform } from 'rt-platforms'
import { LayoutActions } from 'rt-actions'
import { RouteStyle } from 'rt-components'
import { RouteWrapper } from 'rt-components'

const SpotTileStyle = styled.div`
  min-width: 26rem;
  width: 26rem;
  min-height: 12.2rem;
  height: 12.2rem;
  padding: 0 0.575rem 0.5rem 0.575rem;
  margin
`

type RenderCB = (popOut: (x?: number, y?: number) => void, tornOff: boolean) => JSX.Element

const DragWrapper = styled.div`
  height: 100%;
`
/* 
  we create a clone of the dragged node, set some styles and add it to the DOM
  we set the drag image to this node then remove it in a timeout
*/

const createDragImage = (event: React.DragEvent<HTMLDivElement>) => {
  const eventTarget = event.target as HTMLDivElement
  event.dataTransfer.setData('text/plain', eventTarget.id)
  const dt = event.dataTransfer

  const clientRect = eventTarget.getBoundingClientRect()
  const y = clientRect.top
  const x = clientRect.left
  if (typeof dt.setDragImage === 'function') {
    const node = event.currentTarget.cloneNode(true) as HTMLDivElement
    node.classList.add('tearOff')
    node.style.top = `${Math.max(0, y)}px`
    node.style.left = `${Math.max(0, x)}px`
    node.style.position = 'absolute'
    node.style.pointerEvents = 'none'
    node.style.opacity = '1'

    node.style.width = clientRect.width + 'px'
    node.style.height = clientRect.height + 'px'

    document.body.appendChild(node)

    const offsetX = event.clientX - clientRect.left
    const offsetY = event.clientY - clientRect.top

    dt.setDragImage(node, offsetX, offsetY)
    setTimeout(function () {
      node.remove()
    })
  }
}

export interface TearOffProps {
  id: string
  render: RenderCB
  externalWindowProps: Partial<ExternalWindowProps>
  tornOff: boolean
  x?: number
  y?: number
  dragTearOff: boolean
}

export interface PortalProps {
  children: React.ReactNode,
  className?: string,
  element?: string
  onUnload?: Function
  externalWindowProps?: Partial<ExternalWindowProps>
}


function copyStyles(sourceDoc: Document, targetDoc: Document) {
  Array.from(sourceDoc.querySelectorAll('link[rel="stylesheet"], style, meta'))
    .forEach(stylesheet => {
      console.info('copying stylesheet:', stylesheet)
      targetDoc.head.appendChild(stylesheet.cloneNode(true));
    })
}

function removeStyles(document: Document) {
  document.querySelectorAll('link[rel="stylesheet"], style, meta')
    .forEach(stylesheet => {
      console.log('deleting stylesheet:', stylesheet)
      stylesheet.parentNode!.removeChild(stylesheet)
    })
}

export const Portal = ({
  children,
  className = 'portal',
  element = 'div',
  externalWindowProps,
  onUnload
}: PortalProps) => {
  const [container] = useState(() => {
    const el = document.createElement(element)
    el.classList.add(className)
    return el
  })

  let externalWindow: Window
  useEffect(() => {
    console.info('in useEffect')
    externalWindow = window.open('', '', 'width=400, height=200, left=200, top=200') as Window;
    if (onUnload instanceof Function) {
      externalWindow.addEventListener('unload', () => onUnload())
    }
    externalWindow.document.body.appendChild(container)
    //console.info('externalWP title', externalWindowProps.title)
    //externalWindow.document.title = externalWindowProps.config.name
    copyStyles(document, externalWindow!.document)

    const options = {
      childList: true,
      subtree: true
    }

    const onCssChange = () => {
      removeStyles(externalWindow.document)
      copyStyles(document, externalWindow!.document);
    }

    const observer = new MutationObserver(onCssChange)
    observer.observe(document.head, options)

    return () => {
      console.info("In Portal return")
      observer.disconnect()
    }
  }, [])

  return ReactDOM.createPortal(children, container)
}


const TearOff: React.FC<TearOffProps> = ({ render, externalWindowProps, tornOff, dragTearOff }) => {
  const platform = usePlatform()
  const { allowTearOff } = platform
  const targetMouseXRef = useRef<number>()
  const targetMouseYRef = useRef<number>()

  const dispatch = useDispatch()
  const windowName = externalWindowProps.config && externalWindowProps.config.name
  const popOut = useCallback(
    (mouseScreenX?: number, mouseScreenY?: number) => {
      console.info('in popOut definition')
      const popOutX =
        typeof targetMouseXRef.current !== 'undefined' && typeof mouseScreenX !== 'undefined'
          ? mouseScreenX - targetMouseXRef.current
          : mouseScreenX
      const popOutY =
        typeof targetMouseYRef.current !== 'undefined' && typeof mouseScreenY !== 'undefined'
          ? mouseScreenY - targetMouseYRef.current
          : mouseScreenY

      dispatch(
        LayoutActions.updateContainerVisibilityAction({
          name: windowName,
          display: false,
          x: popOutX,
          y: popOutY
        })
      )
    },
    [windowName, dispatch]
  )
  const popIn = useCallback(
    () => {
      console.info("in popIn definition")
      dispatch(LayoutActions.updateContainerVisibilityAction({ name: windowName, display: true }))
    },
    [windowName, dispatch]
  )

  const onMouseDownCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const eventTarget = event.currentTarget as HTMLDivElement

    // calculating mouse position relative to the torn off widget
    const clientRect = eventTarget.getBoundingClientRect()
    targetMouseXRef.current = event.clientX - clientRect.left
    targetMouseYRef.current = event.clientY - clientRect.top
  }

  if (tornOff) {
    if (['LiveRates', 'analytics'].includes(externalWindowProps!.config!.name!)) { // only apply to tiles
      return (
        <ExternalWindow onUnload={popIn} {...externalWindowProps} />
      )
    }
    return (
      <Portal onUnload={popIn} externalWindowProps={externalWindowProps}>
        <RouteWrapper>
          <SpotTileStyle>
            {render(popIn, tornOff)}
          </SpotTileStyle>
        </ RouteWrapper>
      </Portal>
    )
  }

  if (dragTearOff) {
    return (
      <DragWrapper
        draggable={allowTearOff}
        onDragEnd={(event: React.DragEvent<HTMLDivElement>) => popOut(event.screenX, event.screenY)}
        onDragStart={createDragImage}
        onMouseDownCapture={onMouseDownCapture}
        data-qa="tear-off__drag-wrapper"
      >
        {render(popOut, tornOff)}
      </DragWrapper>
    )
  }
  return render(popOut, tornOff)
}

export default TearOff
