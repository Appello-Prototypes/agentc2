# Preventive Measures: React Hooks Best Practices

**Date:** 2026-03-04  
**Context:** Lessons learned from React Error #300 in workspace chat  

---

## Overview

After experiencing a P0 crash caused by a conditional return in a component using React hooks, we've identified patterns to avoid and best practices to follow when building complex React components in this codebase.

---

## Anti-Patterns to Avoid

### ❌ 1. Conditional Returns Based on Dynamic State

**Bad:**
```typescript
function ChatComponent() {
    const [messages, setMessages] = useState([]);
    const { data } = useChat();
    const [user] = useSession();
    // ... 40+ more hooks
    
    if (messages.length === 0) {
        return <LandingPage />;  // ⚠️ DANGEROUS
    }
    
    return <ChatInterface />;
}
```

**Why it's dangerous:**
- Creates fragile component structure
- Hook reconciliation issues during state transitions
- Difficult to debug (minified React errors)
- Violates spirit of React's Rules of Hooks

**Good:**
```typescript
function ChatComponent() {
    const [messages, setMessages] = useState([]);
    const { data } = useChat();
    const [user] = useSession();
    // ... all hooks
    
    return (
        <div>
            {messages.length === 0 && <LandingPage />}
            {messages.length > 0 && <ChatInterface />}
        </div>
    );
}
```

### ❌ 2. Excessive Hook Count in Single Component

**Warning Signs:**
- More than 20 hooks in a single component
- Multiple useState, useEffect, useCallback in sequence
- Difficult to track hook dependencies

**Solution:**
- Extract custom hooks for related logic
- Split component into smaller, focused components
- Use component composition patterns

**Example:**
```typescript
// ❌ Bad: 40+ hooks in one component
function HugeComponent() {
    const [state1, setState1] = useState();
    const [state2, setState2] = useState();
    // ... 38 more hooks
}

// ✅ Good: Extract into custom hooks
function HugeComponent() {
    const conversation = useConversation();
    const voiceState = useVoiceConversation();
    const agentSelection = useAgentSelection();
    // Clean, manageable
}
```

### ❌ 3. Conditional Hook Calls

**Bad:**
```typescript
function Component({ isLoading }) {
    if (isLoading) {
        return <Spinner />;
    }
    
    const data = useQuery();  // ⚠️ Hook called conditionally
    return <Content data={data} />;
}
```

**Good:**
```typescript
function Component({ isLoading }) {
    const data = useQuery();  // ✅ Always called
    
    if (isLoading) {
        return <Spinner />;
    }
    
    return <Content data={data} />;
}
```

### ❌ 4. JSX Variables with Hooks in Child Components

**Risky Pattern:**
```typescript
function Parent() {
    const element = <ChildWithHooks />;  // ⚠️ Created early
    
    if (condition) {
        return element;
    }
    
    return <OtherChild />;
}
```

**Safer:**
```typescript
function Parent() {
    if (condition) {
        return <ChildWithHooks />;  // ✅ Direct rendering
    }
    
    return <OtherChild />;
}
```

---

## Best Practices

### ✅ 1. Structure Components Top-to-Bottom

**Recommended Order:**
1. Component function declaration
2. All hooks (useState, useEffect, custom hooks, etc.)
3. Derived state and handlers
4. JSX variables (if needed)
5. Single return statement with conditional rendering

**Example:**
```typescript
function Component() {
    // 1. Hooks
    const [state, setState] = useState();
    const data = useQuery();
    useEffect(() => { ... });
    
    // 2. Derived state
    const computed = useMemo(() => state * 2, [state]);
    
    // 3. Handlers
    const handleClick = useCallback(() => { ... }, []);
    
    // 4. JSX variables (optional)
    const sharedButton = <Button onClick={handleClick} />;
    
    // 5. Single return with conditional rendering
    return (
        <div>
            {state && <ActiveView />}
            {!state && <EmptyView />}
            {sharedButton}
        </div>
    );
}
```

### ✅ 2. Use Conditional Rendering, Not Conditional Returns

**Pattern:**
```typescript
return (
    <Container>
        {conditionA && <ComponentA />}
        {conditionB && <ComponentB />}
        {!conditionA && !conditionB && <FallbackComponent />}
    </Container>
);
```

### ✅ 3. Extract Complex Logic into Custom Hooks

**Instead of:**
```typescript
function Component() {
    const [state1, setState1] = useState();
    const [state2, setState2] = useState();
    useEffect(() => { /* complex sync logic */ }, [state1, state2]);
    useEffect(() => { /* more complex logic */ }, [state1]);
    // ... many more hooks
}
```

**Do:**
```typescript
function useComplexState() {
    const [state1, setState1] = useState();
    const [state2, setState2] = useState();
    useEffect(() => { /* complex sync logic */ }, [state1, state2]);
    return { state1, state2, setState1, setState2 };
}

function Component() {
    const complexState = useComplexState();
    // Clean component code
}
```

### ✅ 4. Test State Transitions

**Critical for components with:**
- Conditional rendering based on state
- Streaming/async data updates
- Multiple UI states (loading, empty, populated)

**Test checklist:**
- Initial render (empty state)
- Loading state
- Data arrives (transition)
- Error state
- Re-renders during async operations

### ✅ 5. Add ESLint Rules

**Ensure these rules are enabled:**
```json
{
    "rules": {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn"
    }
}
```

---

## Specific Guidance for useChat Hook

The `@ai-sdk/react` `useChat` hook requires special attention:

### Key Characteristics

- Manages internal state for streaming
- Triggers multiple rapid re-renders during streaming
- Expects consistent component structure across renders

### Best Practices

1. **Always call before any conditional logic:**
   ```typescript
   const { messages, sendMessage, status } = useChat({ ... });
   const hasMessages = messages.length > 0;  // Derive after
   ```

2. **Don't conditionally render parents of useChat:**
   ```typescript
   // ❌ Bad
   {isReady && <ChatWrapper />}  // ChatWrapper contains useChat
   
   // ✅ Good
   <ChatWrapper>
       {isReady && <ChatUI />}
   </ChatWrapper>
   ```

3. **Test during streaming:**
   - Submit message
   - Wait 5-10 seconds for full streaming response
   - Verify no crashes or hook errors

4. **Keep transport stable:**
   ```typescript
   const transport = useMemo(() => new DefaultChatTransport({ ... }), [
       stableDependencies  // Don't change during streaming
   ]);
   ```

---

## Code Review Checklist

When reviewing PRs that modify React components:

- [ ] No conditional returns based on dynamic state
- [ ] All hooks called before any conditional logic
- [ ] Components with 20+ hooks have justification or refactoring plan
- [ ] useChat components tested during streaming
- [ ] No conditional hook calls
- [ ] ESLint rules passing (react-hooks/rules-of-hooks)
- [ ] State transitions tested manually or with tests

---

## Refactoring Guidance

If you encounter a component with conditional returns:

### Quick Assessment

1. **Count hooks:** More than 20 → consider splitting
2. **Check returns:** Multiple returns based on state → refactor to conditional rendering
3. **Test coverage:** No tests → add before refactoring

### Refactoring Steps

1. **Keep all hooks at top** (no changes needed)
2. **Identify return conditions** (e.g., `if (!hasMessages)`)
3. **Extract JSX from each return** into separate variables or fragments
4. **Replace with single return + conditional rendering:**
   ```typescript
   return (
       <>
           {condition1 && <StateA />}
           {condition2 && <StateB />}
       </>
   );
   ```
5. **Test thoroughly** (especially state transitions)

---

## Common React Hook Errors

### Error #300: "Rendered fewer hooks than expected"

**Cause:** Conditional return or conditional hook call

**Solution:** Move all hooks before conditional logic, use conditional rendering

**Related:** This document was created after fixing this exact error in workspace chat

### Error #301: "Rendered more hooks than expected"

**Cause:** Hook called inside loop, condition, or nested function

**Solution:** Move hooks to top level of component

### Warning: "Missing dependency in useEffect"

**Cause:** ESLint detected missing dependency in hook array

**Solution:** Add dependency or use ESLint disable comment if intentional

---

## Resources

- [React Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [React Hook Flow Diagram](https://github.com/donavon/hook-flow)
- [AI SDK Documentation](https://sdk.vercel.ai/docs/ai-sdk-ui/overview)

---

## Change Log

- **2026-03-04:** Initial version created after workspace chat React error #300 incident
