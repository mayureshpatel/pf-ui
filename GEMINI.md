# pf-ui Instructions

This document outlines the specific rules, commands, and structures for the Angular frontend service. It acts as an extension to the root `GEMINI.md` file.

## Build and Run Commands
When modifying or interacting with the frontend, utilize the following Angular CLI commands:
- **Run locally:** `ng serve`
- **Run on local network:** `ng serve --configuration local-net`
- **Build the project:** `ng build`
- **Run tests:** `ng test`

## Folder Structure
The UI application code is housed under the `src/app` directory. Strictly enforce the following folder organization:

- **`core/`**: Authentication services, application-wide singletons, and core infrastructure logic.
- **`features/`**: Specific, module-bound application features and views.
- **`models/`**: TypeScript interfaces, types, and application models.
- **`shared/`**: Pipes, directives, UI components, and generic services used across multiple features throughout the application.
