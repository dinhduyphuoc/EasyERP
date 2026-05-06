import { useEffect, useRef, useState, type ReactNode } from 'react'

export type ValidationTrigger = 'change' | 'blur' | 'change-or-blur'

type UseFieldValidationArgs<TValue> = {
  value: TValue
  validate?: (value: TValue) => string | undefined
  validateWhen?: ValidationTrigger
  shouldValidate?: (value: TValue) => boolean
  submitError?: ReactNode
  clearSubmitErrorOnChange?: boolean
}

const defaultShouldValidate = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return value !== null && value !== undefined
}

export function useFieldValidation<TValue>({
  value,
  validate,
  validateWhen = 'change-or-blur',
  shouldValidate = defaultShouldValidate,
  submitError,
  clearSubmitErrorOnChange = true,
}: UseFieldValidationArgs<TValue>) {
  const [hasInteracted, setHasInteracted] = useState(false)
  const [liveValidationMessage, setLiveValidationMessage] = useState<string | undefined>(undefined)
  const [submitErrorDismissed, setSubmitErrorDismissed] = useState(false)
  const previousSubmitErrorRef = useRef<ReactNode>(submitError)

  useEffect(() => {
    if (previousSubmitErrorRef.current !== submitError) {
      previousSubmitErrorRef.current = submitError
      setSubmitErrorDismissed(false)
    }
  }, [submitError])

  useEffect(() => {
    if (!validate || !hasInteracted) {
      return
    }

    if (!shouldValidate(value)) {
      setLiveValidationMessage(undefined)
      return
    }

    setLiveValidationMessage(validate(value))
  }, [hasInteracted, shouldValidate, validate, value])

  const runValidation = (nextValue: TValue) => {
    if (!validate) {
      setLiveValidationMessage(undefined)
      return
    }

    if (!shouldValidate(nextValue)) {
      setLiveValidationMessage(undefined)
      return
    }

    setLiveValidationMessage(validate(nextValue))
  }

  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true)
    }
  }

  const handleChangeValidation = (nextValue: TValue) => {
    handleInteraction()

    if (submitError && clearSubmitErrorOnChange) {
      setSubmitErrorDismissed(true)
    }

    if (validateWhen === 'change' || validateWhen === 'change-or-blur') {
      runValidation(nextValue)
    }
  }

  const handleBlurValidation = (nextValue: TValue) => {
    handleInteraction()

    if (validateWhen === 'blur' || validateWhen === 'change-or-blur') {
      runValidation(nextValue)
    }
  }

  const activeSubmitError = submitErrorDismissed ? undefined : submitError

  return {
    activeSubmitError,
    liveValidationMessage,
    effectiveError: Boolean(activeSubmitError) || Boolean(liveValidationMessage),
    effectiveHelperText: activeSubmitError ?? liveValidationMessage,
    handleChangeValidation,
    handleBlurValidation,
  }
}
