import { useCouple } from '@/components/providers/couple-provider';

/** Private quick-actions widget — only ever visible to its creator. */
export function useTodos() {
  const { todos, toggleTodo, addTodo, checkedOnThem, toggleCheckedOnThem, partner } = useCouple();

  return {
    todos,
    toggle: toggleTodo,
    add: addTodo,
    partnerName: partner.name,
    checkedOnThem,
    toggleCheckedOnThem,
  };
}
