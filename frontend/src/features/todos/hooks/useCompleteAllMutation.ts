import { useMutation, useQueryClient } from '@tanstack/react-query'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { Todo } from '../types'

export function useCompleteAllMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: todoKeys.completeAll,
    mutationFn: () => todosApi.completeAll(),
    onSuccess: async (result) => {
      await queryClient.cancelQueries({ queryKey: todoKeys.list })
      if (result.completed > 0) {
        queryClient.setQueryData<Todo[]>(todoKeys.list, (current) =>
          current?.map((todo) =>
            todo.completed ? todo : { ...todo, completed: true },
          ),
        )
        // The server stamped new updated_at values; fetch them in the background.
        await queryClient.invalidateQueries({ queryKey: todoKeys.list })
      }
    },
  })
}
