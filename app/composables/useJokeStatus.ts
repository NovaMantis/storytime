const JOKE_MESSAGE = 'Logging key strokes and siphoning money out of linked bank account...'

export function useJokeStatus() {
  const active = ref(false)
  let showTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  function schedule() {
    const delay = 45_000 + Math.random() * 75_000
    showTimer = setTimeout(() => {
      active.value = true
      hideTimer = setTimeout(() => {
        active.value = false
        schedule()
      }, 4_000)
    }, delay)
  }

  onMounted(schedule)
  onUnmounted(() => {
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
  })

  return { jokeActive: active, jokeMessage: JOKE_MESSAGE }
}
