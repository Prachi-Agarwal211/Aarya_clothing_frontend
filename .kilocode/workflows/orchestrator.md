# AI Agent Orchestrator for Deep Code Analysis

This workflow orchestrates multiple AI agents that leverage MCP (Model Context Protocol) tools to perform comprehensive code analysis, documentation generation, and intelligent code improvements.

## Grounding Rules

- Read the authoritative source files before making claims about behavior.
- Use only tools that are present in the active MCP settings or explicitly documented in this repo.
- Mark uncertain statements as inference, not fact.
- Re-read any edited file before declaring the task complete.
- Follow the `grounded-coding-contract.md` workflow for all analysis and implementation work.

## Overview

The orchestrator coordinates specialized agents to:
- Analyze codebase structure and dependencies
- Generate comprehensive documentation
- Identify improvement opportunities
- Create automated tests
- Optimize performance and security

## Agents and Their MCP Tool Usage

### 1. Code Structure Analyzer Agent
**Purpose**: Deep codebase structure analysis and dependency mapping

**MCP Tools Used**:
- `code-analyzer`: ESLint analysis for code quality
- `filesystem`: Explore directory structure and file contents
- `github`: Repository analysis and commit history
- `everything`: Comprehensive file system operations
- `memory`: Store codebase patterns and relationships
- `sequentialthinking`: Logical code structure analysis

**Deep Analysis Tasks**:
- **Complete Codebase Mapping**: Create comprehensive map of entire codebase structure
- **Dependency Graph Analysis**: Build complete dependency trees and import relationships
- **Code Pattern Recognition**: Identify all coding patterns, conventions, and anti-patterns
- **Architecture Documentation**: Document system architecture, data flows, and component interactions
- **Technology Stack Analysis**: Identify all technologies, frameworks, and versions used
- **Code Quality Assessment**: Comprehensive quality metrics across entire codebase
- **Legacy Code Detection**: Identify outdated patterns and deprecated approaches
- **Integration Points**: Map all external integrations and API connections

### 2. Documentation Generator Agent
**Purpose**: Generate comprehensive technical documentation

**MCP Tools Used**:
- `deepwiki`: Advanced documentation generation
- `context7`: Context-aware content creation
- `sequentialthinking`: Logical documentation structure
- `memory`: Store and retrieve documentation patterns
- `filesystem`: Access all code files for documentation extraction
- `everything`: Comprehensive content analysis

**Comprehensive Documentation Tasks**:
- **Complete API Documentation**: Auto-generate API docs from all endpoints and functions
- **Architecture Documentation**: Create detailed system architecture guides
- **Code Structure Maps**: Visual representations of codebase organization
- **Setup and Deployment Guides**: Step-by-step setup instructions
- **Developer Onboarding**: Comprehensive guides for new developers
- **Code Standards Documentation**: Document all coding standards and conventions
- **Integration Documentation**: Document all external integrations and APIs
- **Testing Documentation**: Document testing strategies and procedures
- **Performance Documentation**: Document performance characteristics and optimization guides
- **Security Documentation**: Security guidelines and best practices

### 3. Security and Performance Analyzer Agent
**Purpose**: Identify security vulnerabilities and performance bottlenecks

**MCP Tools Used**:
- `code-analyzer`: Security vulnerability detection
- `everything`: Performance metrics collection
- `fetch`: External security database queries
- `duckduckgo`: Latest security research integration

**Tasks**:
- Scan for common security vulnerabilities
- Analyze performance bottlenecks
- Suggest optimization strategies
- Generate security audit reports

### 4. Test Generation Agent
**Purpose**: Create comprehensive test suites

**MCP Tools Used**:
- `playwright`: E2E test generation
- `puppeteer`: Browser automation testing
- `mcp-playwright`: Advanced testing scenarios
- `memory`: Test pattern storage and reuse

**Tasks**:
- Generate unit tests from function signatures
- Create integration tests for API endpoints
- Build E2E test scenarios
- Maintain test coverage metrics

### 5. Code Improvement Agent
**Purpose**: Suggest and implement code improvements

**MCP Tools Used**:
- `code-analyzer`: Code quality suggestions
- `filesystem`: Read the exact source files being changed
- `github`: Best practices from similar repositories
- `sequentialthinking`: Logical improvement strategies
- `memory`: Record confirmed patterns and decisions only

**Tasks**:
- Refactor code for better maintainability
- Apply design patterns and best practices
- Optimize algorithms and data structures
- Ensure code consistency across the project
- Verify every proposed change against the current codebase before implementation

## Workflow Steps

### Phase 1: Initialization and Discovery
1. **Environment Setup**
   - Initialize all MCP connections
   - Verify tool availability and permissions
   - Set up workspace context
   - Load the grounded coding contract before making any conclusions

2. **Codebase Discovery**
   - Use `filesystem` to map project structure
   - Identify technology stack and frameworks
   - Document configuration files and dependencies

### Phase 2: Parallel Analysis Execution
3. **Concurrent Agent Execution**
   - Launch all specialized agents simultaneously
   - Each agent uses specific MCP tools for their domain
   - Coordinate through shared memory storage

4. **Data Collection and Synthesis**
   - Aggregate analysis results from all agents
   - Use `memory` to store intermediate findings
   - Cross-reference insights between agents
   - Separate confirmed facts from hypotheses in all synthesis output

### Phase 3: Comprehensive Reporting
5. **Generate Unified Report**
   - Combine all agent findings into cohesive report
   - Use `deepwiki` for advanced formatting
   - Create actionable recommendations

6. **Implementation Planning**
   - Prioritize improvements based on impact and effort
   - Create detailed implementation roadmaps
   - Generate automated scripts where possible

### Phase 4: Validation and Iteration
7. **Quality Assurance**
   - Validate all generated code and documentation
   - Run automated tests using `playwright`
   - Verify improvements don't break existing functionality

8. **Continuous Learning**
   - Store successful patterns in `memory`
   - Update agent strategies based on results
   - Maintain knowledge base for future analyses

## MCP Tool Configuration Requirements

### Essential Tools
- `code-analyzer`: Must have full access to all files
- `filesystem`: Read access to entire codebase
- `memory`: Write permissions for pattern storage
- `github`: Access to repository for analysis

### Optional but Recommended
- `deepwiki`: For advanced documentation
- `playwright`: For testing capabilities
- `everything`: For comprehensive operations
- `sequentialthinking`: For logical analysis

## Execution Commands

### Quick Analysis
```bash
# Run basic code analysis
mcp-orchestrator --mode=quick --target=./src

# Full comprehensive analysis
mcp-orchestrator --mode=full --target=./ --output=./reports

# Security-focused analysis
mcp-orchestrator --mode=security --target=./ --severity=high
```

### Agent-Specific Execution
```bash
# Run only documentation agent
mcp-orchestrator --agent=documentation --target=./src

# Run performance analysis
mcp-orchestrator --agent=performance --target=./src --metrics=all

# Generate tests only
mcp-orchestrator --agent=testing --target=./src --coverage=90
```

## Output Formats

### Analysis Reports
- **JSON**: Structured data for programmatic use
- **Markdown**: Human-readable documentation
- **HTML**: Interactive web reports
- **CSV**: Metrics and statistics

### Generated Artifacts
- **Documentation**: API docs, architecture guides
- **Tests**: Unit, integration, and E2E test suites
- **Code**: Refactored and optimized code snippets
- **Scripts**: Automation and deployment scripts

## Best Practices

### Agent Coordination
- Use `memory` for inter-agent communication
- Implement conflict resolution for overlapping suggestions
- Maintain audit trails of all agent actions

### Tool Usage Optimization
- Cache MCP tool responses to reduce API calls
- Batch operations where possible
- Respect rate limits and quotas

### Quality Assurance
- Validate all generated content
- Maintain backward compatibility
- Provide rollback mechanisms for changes
- Re-open the modified files and compare them against the requested behavior
- Avoid asserting unverified architecture, tool availability, or runtime behavior

## Troubleshooting

### Common Issues
- **MCP Connection Failures**: Verify tool configurations
- **Memory Storage Issues**: Check permissions and quotas
- **Agent Conflicts**: Use priority-based resolution

### Performance Optimization
- Parallelize independent operations
- Use incremental analysis for large codebases
- Implement result caching strategies

## Integration Options

### CI/CD Pipeline
```yaml
# Example GitHub Actions integration
- name: Run AI Code Analysis
  uses: ./.github/actions/ai-analysis
  with:
    mode: 'security'
    output-format: 'sarif'
    fail-on-issues: true
```

### IDE Integration
- Real-time code analysis suggestions
- Automated documentation generation
- Intelligent code completion improvements

## Monitoring and Metrics

### Analysis Metrics
- Code coverage improvements
- Security vulnerability reductions
- Performance optimization gains
- Documentation completeness scores

### Agent Performance
- Execution time tracking
- Tool usage efficiency
- Accuracy measurements
- Resource utilization monitoring

This orchestrator workflow enables comprehensive, AI-driven code analysis that leverages the full power of MCP tools to provide actionable insights and improvements for any codebase.
