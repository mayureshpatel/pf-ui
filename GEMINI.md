# Frontend (`pf-ui`) Instructions

## Framework & Tooling
- **Framework:** Angular v21 (Signals-based).
- **Styling:** Tailwind CSS v4 and PrimeNg v21. 
	- **Theme:** "Soft & Friendly" (rounded corners, earthy/calm primary colors).
	- **Customization:** Configured in `src/styles.css` using CSS variables.
- **State Management:** Strictly use **Signals**. Avoid RxJS where Signals are more appropriate.

## Components & Naming
- **File Naming:** Use `<feature-name>.component.[ts|html|css]`.
- **Class Naming:** Use **PascalCase without the "Component" suffix** (e.g., `export class UserProfile`).
- **Formatting:** Ensure all code is formatted using **Prettier**.

## Error Handling & Feedback
- **Global Handling:** Use Global Angular Error Handlers and HTTP Interceptors.
- **User Feedback:** Use **Toast** notifications for safely vague error information.
- **Logging:** Keep frontend logging to an absolute minimum.

## Testing Mandate
- **Bug Fixes (TDD):** Adhere strictly to Test-Driven Development for bugs. You must write a failing test that reproduces the issue *before* applying the fix.
- **Architecture:** Tests must test *behavior*, not internal implementation details, and reside in a `/test/` directory mirroring the production code structure.
