import { useContext, createContext, FC, useMemo, useState, createElement } from 'react'
import Axios, { Canceler, AxiosResponse } from 'axios'
import immer from 'immer'

type Context = Readonly<{
  language: string
  updateLanguage: (language: string) => void
  t(path: string, key: string, defaultValue?: string): string
  t<Value>(path: string, key: string, defaultValue: Value): Value
}>

const Context = createContext<Context>(null as any)

export const useTranslation = () => useContext(Context)

export type Props = Readonly<{
  host?: string
  language?: string
}>

type State = Readonly<{
  language: string
  translation: Readonly<Record<string, Readonly<Record<string, any>>>>
}>

const loadingMap = new Map<string, Canceler>()

export const Provider: FC<Props> = ({ host = window.location.href, language = 'en', children }) => {
  const [state, setState] = useState<State>(() => ({ language, translation: {} }))

  const createContext = (): Context => {
    const getTranslation = <Value>(path: string, key: string, defaultValue: Value = '' as any): Value => {
      // 불러오는 중이면 패스
      if (loadingMap.has(path)) {
        return defaultValue
      }

      // 매치하는 번역이 있으면 return
      if (state.translation[path] && state.translation[path][key]) {
        const value = state.translation[path][key]
        return value === undefined ? defaultValue : value
      }

      // 번역 불러오기
      const translationPath = `${host}/${state.language}/${path}`
      const { token, cancel } = Axios.CancelToken.source()
      loadingMap.set(path, cancel)

      const updateTranslation = ({ data }: AxiosResponse<any>) => {
        loadingMap.delete(path)
        setState(state => {
          const nextState = immer(state, draft => {
            draft.translation[path] = data
          })
          return nextState
        })
      }
      Axios.get(translationPath, { cancelToken: token })
        .then(updateTranslation)
        .catch(() => console.log('canceled!'))

      return defaultValue
    }

    const updateLanguage = (language: string) => {
      for (const cancelToLoad of loadingMap.values()) {
        cancelToLoad()
      }

      setState({ language, translation: {} })
    }

    return {
      language: state.language,
      t: getTranslation,
      updateLanguage
    }
  }

  const value = useMemo(createContext, [state])
  return createElement(Context.Provider, { value }, children)
}
