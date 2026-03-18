# Deep Code Analysis Workflow

This workflow implements comprehensive deep code analysis capabilities that ensure complete understanding of the entire codebase structure, dependencies, and improvement opportunities.

## Grounding Rules

- Verify the relevant source files before claiming anything about the codebase.
- Treat all code blocks in this document as illustrative unless they are backed by actual workspace evidence.
- Do not assume MCP tools, methods, or data models exist unless they are present in the active configuration or repo.
- If a conclusion depends on missing evidence, state that it is unverified.
- Re-read modified files before reporting completion.

## Deep Analysis Architecture

### 1. Complete Codebase Discovery Engine

The following snippet is pseudo-code for orchestration shape, not a guarantee that each method exists exactly as named.

```python
class CompleteCodebaseDiscovery:
    def __init__(self, mcp_tools):
        self.mcp_tools = mcp_tools
        self.codebase_map = CodebaseMap()
        self.dependency_graph = DependencyGraph()
        self.structure_analyzer = StructureAnalyzer()
    
    async def discover_entire_codebase(self, root_path: str) -> CompleteCodebaseModel:
        """Discover and analyze entire codebase comprehensively"""
        
        # Phase 1: Complete File System Discovery
        file_structure = await self.discover_file_structure(root_path)
        
        # Phase 2: Technology Stack Identification
        tech_stack = await self.identify_technology_stack(file_structure)
        
        # Phase 3: Dependency Analysis
        dependencies = await self.analyze_all_dependencies(file_structure)
        
        # Phase 4: Code Pattern Analysis
        patterns = await self.analyze_code_patterns(file_structure)
        
        # Phase 5: Architecture Mapping
        architecture = await self.map_architecture(file_structure, dependencies)
        
        # Phase 6: Integration Discovery
        integrations = await self.discover_integrations(file_structure)
        
        return CompleteCodebaseModel(
            file_structure=file_structure,
            technology_stack=tech_stack,
            dependencies=dependencies,
            patterns=patterns,
            architecture=architecture,
            integrations=integrations
        )
    
    async def discover_file_structure(self, root_path: str) -> FileStructure:
        """Discover complete file structure with metadata"""
        
        # Use filesystem tool for comprehensive discovery
        all_files = await self.mcp_tools['filesystem'].list_all_files(root_path, recursive=True)
        
        file_structure = FileStructure(root_path=root_path)
        
        for file_path in all_files:
            file_info = await self.analyze_file_comprehensively(file_path)
            file_structure.add_file(file_info)
        
        # Build directory hierarchy
        file_structure.build_hierarchy()
        
        return file_structure
    
    async def analyze_file_comprehensively(self, file_path: str) -> FileInfo:
        """Comprehensive file analysis"""
        
        file_info = FileInfo(path=file_path)
        
        # Basic file properties
        file_info.size = await self.get_file_size(file_path)
        file_info.type = self.determine_file_type(file_path)
        file_info.extension = self.get_file_extension(file_path)
        
        # Content analysis
        if file_info.type in ['code', 'config', 'documentation']:
            content = await self.mcp_tools['filesystem'].read_file(file_path)
            file_info.content_analysis = await self.analyze_content(content, file_info.type)
        
        # Language-specific analysis
        if file_info.type == 'code':
            file_info.language_analysis = await self.analyze_language_specifics(content, file_path)
        
        # Dependency analysis
        file_info.dependencies = await self.extract_file_dependencies(content, file_info.type)
        
        return file_info
```

### 2. Comprehensive Dependency Analysis

```python
class ComprehensiveDependencyAnalyzer:
    def __init__(self, mcp_tools):
        self.mcp_tools = mcp_tools
        self.dependency_graph = DependencyGraph()
        self.circular_dependency_detector = CircularDependencyDetector()
    
    async def analyze_all_dependencies(self, file_structure: FileStructure) -> CompleteDependencyModel:
        """Analyze all dependencies comprehensively"""
        
        dependency_model = CompleteDependencyModel()
        
        # Analyze import dependencies
        import_deps = await self.analyze_import_dependencies(file_structure)
        dependency_model.import_dependencies = import_deps
        
        # Analyze runtime dependencies
        runtime_deps = await self.analyze_runtime_dependencies(file_structure)
        dependency_model.runtime_dependencies = runtime_deps
        
        # Analyze build dependencies
        build_deps = await self.analyze_build_dependencies(file_structure)
        dependency_model.build_dependencies = build_deps
        
        # Analyze external dependencies
        external_deps = await self.analyze_external_dependencies(file_structure)
        dependency_model.external_dependencies = external_deps
        
        # Build complete dependency graph
        dependency_model.dependency_graph = await self.build_dependency_graph(dependency_model)
        
        # Detect circular dependencies
        dependency_model.circular_dependencies = await self.detect_circular_dependencies(
            dependency_model.dependency_graph
        )
        
        # Analyze dependency health
        dependency_model.dependency_health = await self.analyze_dependency_health(dependency_model)
        
        return dependency_model
    
    async def build_dependency_graph(self, dependency_model: CompleteDependencyModel) -> DependencyGraph:
        """Build comprehensive dependency graph"""
        
        graph = DependencyGraph()
        
        # Add all files as nodes
        for file_info in dependency_model.all_files:
            graph.add_node(file_info.path, file_info.metadata)
        
        # Add import dependencies as edges
        for import_dep in dependency_model.import_dependencies:
            graph.add_edge(
                source=import_dep.source_file,
                target=import_dep.target_file,
                dependency_type='import',
                metadata=import_dep.metadata
            )
        
        # Add runtime dependencies
        for runtime_dep in dependency_model.runtime_dependencies:
            graph.add_edge(
                source=runtime_dep.source_component,
                target=runtime_dep.target_component,
                dependency_type='runtime',
                metadata=runtime_dep.metadata
            )
        
        # Calculate graph metrics
        graph.metrics = await self.calculate_graph_metrics(graph)
        
        return graph
    
    async def analyze_dependency_health(self, dependency_model: CompleteDependencyModel) -> DependencyHealth:
        """Analyze health of all dependencies"""
        
        health = DependencyHealth()
        
        # Check for outdated dependencies
        health.outdated_dependencies = await self.check_outdated_dependencies(
            dependency_model.external_dependencies
        )
        
        # Check for security vulnerabilities
        health.security_issues = await self.check_security_vulnerabilities(
            dependency_model.external_dependencies
        )
        
        # Check for license compatibility
        health.license_issues = await self.check_license_compatibility(
            dependency_model.external_dependencies
        )
        
        # Check for unused dependencies
        health.unused_dependencies = await self.detect_unused_dependencies(
            dependency_model.external_dependencies, dependency_model.import_dependencies
        )
        
        # Calculate overall health score
        health.overall_score = self.calculate_health_score(health)
        
        return health
```

### 3. Architecture Analysis Engine

```python
class ArchitectureAnalysisEngine:
    def __init__(self, mcp_tools):
        self.mcp_tools = mcp_tools
        self.architecture_detector = ArchitectureDetector()
        self.pattern_analyzer = PatternAnalyzer()
        self.layer_analyzer = LayerAnalyzer()
    
    async def analyze_architecture(self, codebase_model: CompleteCodebaseModel) -> ArchitectureModel:
        """Comprehensive architecture analysis"""
        
        architecture = ArchitectureModel()
        
        # Detect architectural patterns
        architecture.patterns = await self.detect_architectural_patterns(codebase_model)
        
        # Analyze layer structure
        architecture.layers = await self.analyze_layer_structure(codebase_model)
        
        # Identify components and modules
        architecture.components = await self.identify_components(codebase_model)
        
        # Analyze data flow
        architecture.data_flow = await self.analyze_data_flow(codebase_model)
        
        # Identify design patterns
        architecture.design_patterns = await self.identify_design_patterns(codebase_model)
        
        # Analyze API structure
        architecture.api_structure = await self.analyze_api_structure(codebase_model)
        
        # Assess architecture quality
        architecture.quality_metrics = await self.assess_architecture_quality(architecture)
        
        return architecture
    
    async def detect_architectural_patterns(self, codebase_model: CompleteCodebaseModel) -> List[ArchitecturalPattern]:
        """Detect architectural patterns used in the codebase"""
        
        patterns = []
        
        # Check for MVC pattern
        mvc_pattern = await self.detect_mvc_pattern(codebase_model)
        if mvc_pattern:
            patterns.append(mvc_pattern)
        
        # Check for microservices pattern
        microservices_pattern = await self.detect_microservices_pattern(codebase_model)
        if microservices_pattern:
            patterns.append(microservices_pattern)
        
        # Check for layered architecture
        layered_pattern = await self.detect_layered_architecture(codebase_model)
        if layered_pattern:
            patterns.append(layered_pattern)
        
        # Check for event-driven architecture
        event_driven_pattern = await self.detect_event_driven_architecture(codebase_model)
        if event_driven_pattern:
            patterns.append(event_driven_pattern)
        
        # Check for repository pattern
        repository_pattern = await self.detect_repository_pattern(codebase_model)
        if repository_pattern:
            patterns.append(repository_pattern)
        
        return patterns
    
    async def analyze_layer_structure(self, codebase_model: CompleteCodebaseModel) -> LayerStructure:
        """Analyze layered architecture structure"""
        
        layer_structure = LayerStructure()
        
        # Identify presentation layer
        layer_structure.presentation_layer = await self.identify_presentation_layer(codebase_model)
        
        # Identify business logic layer
        layer_structure.business_layer = await self.identify_business_layer(codebase_model)
        
        # Identify data access layer
        layer_structure.data_layer = await self.identify_data_layer(codebase_model)
        
        # Identify infrastructure layer
        layer_structure.infrastructure_layer = await self.identify_infrastructure_layer(codebase_model)
        
        # Analyze layer dependencies
        layer_structure.layer_dependencies = await self.analyze_layer_dependencies(layer_structure)
        
        # Check for architectural violations
        layer_structure.violations = await self.detect_architecture_violations(layer_structure)
        
        return layer_structure
```

### 4. Code Quality Assessment System

```python
class CodeQualityAssessmentSystem:
    def __init__(self, mcp_tools):
        self.mcp_tools = mcp_tools
        self.quality_analyzer = QualityAnalyzer()
        self.metrics_calculator = MetricsCalculator()
        self.standards_checker = StandardsChecker()
    
    async def assess_comprehensive_quality(self, codebase_model: CompleteCodebaseModel) -> QualityAssessment:
        """Comprehensive code quality assessment"""
        
        assessment = QualityAssessment()
        
        # Analyze code metrics
        assessment.code_metrics = await self.calculate_comprehensive_metrics(codebase_model)
        
        # Check coding standards compliance
        assessment.standards_compliance = await self.check_standards_compliance(codebase_model)
        
        # Analyze code complexity
        assessment.complexity_analysis = await self.analyze_complexity(codebase_model)
        
        # Check for code smells
        assessment.code_smells = await self.detect_code_smells(codebase_model)
        
        # Analyze maintainability
        assessment.maintainability = await self.analyze_maintainability(codebase_model)
        
        # Check test coverage
        assessment.test_coverage = await self.analyze_test_coverage(codebase_model)
        
        # Calculate overall quality score
        assessment.overall_score = self.calculate_overall_quality_score(assessment)
        
        return assessment
    
    async def calculate_comprehensive_metrics(self, codebase_model: CompleteCodebaseModel) -> CodeMetrics:
        """Calculate comprehensive code metrics"""
        
        metrics = CodeMetrics()
        
        # Calculate size metrics
        metrics.size_metrics = await self.calculate_size_metrics(codebase_model)
        
        # Calculate complexity metrics
        metrics.complexity_metrics = await self.calculate_complexity_metrics(codebase_model)
        
        # Calculate coupling metrics
        metrics.coupling_metrics = await self.calculate_coupling_metrics(codebase_model)
        
        # Calculate cohesion metrics
        metrics.cohesion_metrics = await self.calculate_cohesion_metrics(codebase_model)
        
        # Calculate duplication metrics
        metrics.duplication_metrics = await self.calculate_duplication_metrics(codebase_model)
        
        return metrics
    
    async def detect_code_smells(self, codebase_model: CompleteCodebaseModel) -> List[CodeSmell]:
        """Detect various code smells"""
        
        code_smells = []
        
        # Detect long methods
        long_methods = await self.detect_long_methods(codebase_model)
        code_smells.extend(long_methods)
        
        # Detect large classes
        large_classes = await self.detect_large_classes(codebase_model)
        code_smells.extend(large_classes)
        
        # Detect duplicate code
        duplicate_code = await self.detect_duplicate_code(codebase_model)
        code_smells.extend(duplicate_code)
        
        # Detect feature envy
        feature_envy = await self.detect_feature_envy(codebase_model)
        code_smells.extend(feature_envy)
        
        # Detect data clumps
        data_clumps = await self.detect_data_clumps(codebase_model)
        code_smells.extend(data_clumps)
        
        # Detect primitive obsession
        primitive_obsession = await self.detect_primitive_obsession(codebase_model)
        code_smells.extend(primitive_obsession)
        
        return code_smells
```

### 5. Intelligent Code Improvement Engine

```python
class IntelligentCodeImprovementEngine:
    def __init__(self, mcp_tools):
        self.mcp_tools = mcp_tools
        self.improvement_analyzer = ImprovementAnalyzer()
        self.refactoring_engine = RefactoringEngine()
        self.optimization_engine = OptimizationEngine()
    
    async def generate_comprehensive_improvements(self, codebase_model: CompleteCodebaseModel) -> ImprovementPlan:
        """Generate comprehensive code improvement plan"""
        
        improvement_plan = ImprovementPlan()
        
        # Analyze structural improvements
        structural_improvements = await self.analyze_structural_improvements(codebase_model)
        improvement_plan.structural_improvements = structural_improvements
        
        # Analyze performance improvements
        performance_improvements = await self.analyze_performance_improvements(codebase_model)
        improvement_plan.performance_improvements = performance_improvements
        
        # Analyze security improvements
        security_improvements = await self.analyze_security_improvements(codebase_model)
        improvement_plan.security_improvements = security_improvements
        
        # Analyze maintainability improvements
        maintainability_improvements = await self.analyze_maintainability_improvements(codebase_model)
        improvement_plan.maintainability_improvements = maintainability_improvements
        
        # Analyze testing improvements
        testing_improvements = await self.analyze_testing_improvements(codebase_model)
        improvement_plan.testing_improvements = testing_improvements
        
        # Prioritize improvements
        improvement_plan.prioritized_improvements = await self.prioritize_improvements(improvement_plan)
        
        return improvement_plan
    
    async def analyze_structural_improvements(self, codebase_model: CompleteCodebaseModel) -> List[StructuralImprovement]:
        """Analyze structural improvements"""
        
        improvements = []
        
        # Analyze architecture improvements
        arch_improvements = await self.analyze_architecture_improvements(codebase_model)
        improvements.extend(arch_improvements)
        
        # Analyze design pattern improvements
        pattern_improvements = await self.analyze_design_pattern_improvements(codebase_model)
        improvements.extend(pattern_improvements)
        
        # Analyze dependency improvements
        dependency_improvements = await self.analyze_dependency_improvements(codebase_model)
        improvements.extend(dependency_improvements)
        
        # Analyze module organization improvements
        organization_improvements = await self.analyze_organization_improvements(codebase_model)
        improvements.extend(organization_improvements)
        
        return improvements
    
    async def generate_improvement_implementation(self, improvement: StructuralImprovement) -> ImplementationPlan:
        """Generate detailed implementation plan for improvement"""
        
        implementation = ImplementationPlan(improvement=improvement)
        
        # Analyze impact
        implementation.impact_analysis = await self.analyze_implementation_impact(improvement)
        
        # Generate step-by-step implementation
        implementation.steps = await self.generate_implementation_steps(improvement)
        
        # Identify required tests
        implementation.required_tests = await self.identify_required_tests(improvement)
        
        # Generate rollback plan
        implementation.rollback_plan = await self.generate_rollback_plan(improvement)
        
        # Estimate effort and timeline
        implementation.effort_estimate = await self.estimate_implementation_effort(improvement)
        
        return implementation
```

## Deep Analysis Workflow Execution

### Phase 1: Complete Codebase Discovery

```python
async def execute_deep_code_analysis(root_path: str, mcp_tools: Dict[str, Any]) -> DeepAnalysisResult:
    """Execute comprehensive deep code analysis"""
    
    # Initialize analysis components
    discovery_engine = CompleteCodebaseDiscovery(mcp_tools)
    dependency_analyzer = ComprehensiveDependencyAnalyzer(mcp_tools)
    architecture_analyzer = ArchitectureAnalysisEngine(mcp_tools)
    quality_assessor = CodeQualityAssessmentSystem(mcp_tools)
    improvement_engine = IntelligentCodeImprovementEngine(mcp_tools)
    
    # Phase 1: Complete Codebase Discovery
    print("Phase 1: Discovering complete codebase...")
    codebase_model = await discovery_engine.discover_entire_codebase(root_path)
    
    # Store discovered model in memory
    await mcp_tools['memory'].store_codebase_model(codebase_model)
    
    # Phase 2: Comprehensive Dependency Analysis
    print("Phase 2: Analyzing dependencies...")
    dependency_model = await dependency_analyzer.analyze_all_dependencies(codebase_model.file_structure)
    codebase_model.dependencies = dependency_model
    
    # Phase 3: Architecture Analysis
    print("Phase 3: Analyzing architecture...")
    architecture_model = await architecture_analyzer.analyze_architecture(codebase_model)
    codebase_model.architecture = architecture_model
    
    # Phase 4: Quality Assessment
    print("Phase 4: Assessing code quality...")
    quality_assessment = await quality_assessor.assess_comprehensive_quality(codebase_model)
    codebase_model.quality = quality_assessment
    
    # Phase 5: Improvement Analysis
    print("Phase 5: Generating improvement plan...")
    improvement_plan = await improvement_engine.generate_comprehensive_improvements(codebase_model)
    
    # Phase 6: Comprehensive Reporting
    print("Phase 6: Generating comprehensive report...")
    report = await generate_comprehensive_analysis_report(codebase_model, improvement_plan)
    
    return DeepAnalysisResult(
        codebase_model=codebase_model,
        improvement_plan=improvement_plan,
        report=report
    )
```

### Phase 2: Continuous Monitoring and Learning

```python
class ContinuousCodeAnalysisMonitor:
    def __init__(self, mcp_tools):
        self.mcp_tools = mcp_tools
        self.analysis_history = []
        self.learning_engine = LearningEngine()
    
    async def monitor_codebase_changes(self, codebase_path: str):
        """Continuously monitor codebase for changes and re-analyze"""
        
        while True:
            # Check for changes
            changes = await self.detect_codebase_changes(codebase_path)
            
            if changes:
                # Analyze impact of changes
                impact_analysis = await self.analyze_change_impact(changes)
                
                # Update codebase model
                await self.update_codebase_model(changes, impact_analysis)
                
                # Re-analyze affected areas
                await self.reanalyze_affected_areas(changes)
                
                # Learn from changes
                await self.learning_engine.learn_from_changes(changes, impact_analysis)
            
            # Wait for next monitoring cycle
            await asyncio.sleep(60)  # Monitor every minute
    
    async def analyze_change_impact(self, changes: List[CodeChange]) -> ChangeImpact:
        """Analyze impact of code changes"""
        
        impact = ChangeImpact()
        
        # Analyze dependency impact
        impact.dependency_impact = await self.analyze_dependency_impact(changes)
        
        # Analyze architecture impact
        impact.architecture_impact = await self.analyze_architecture_impact(changes)
        
        # Analyze quality impact
        impact.quality_impact = await self.analyze_quality_impact(changes)
        
        # Analyze performance impact
        impact.performance_impact = await self.analyze_performance_impact(changes)
        
        # Analyze security impact
        impact.security_impact = await self.analyze_security_impact(changes)
        
        return impact
```

## Integration with MCP Tools

### Tool Coordination Strategy

```python
class MCPToolCoordinator:
    def __init__(self, mcp_tools):
        self.mcp_tools = mcp_tools
        self.tool_usage_optimizer = ToolUsageOptimizer()
        self.cache_manager = CacheManager()
    
    async def coordinate_deep_analysis(self, analysis_task: DeepAnalysisTask) -> AnalysisResult:
        """Coordinate MCP tools for deep analysis"""
        
        # Optimize tool usage strategy
        tool_strategy = await self.tool_usage_optimizer.optimize_strategy(analysis_task)
        
        # Execute coordinated analysis
        results = {}
        
        for tool_name, tool_config in tool_strategy.tool_configurations.items():
            # Check cache first
            cache_key = self.generate_cache_key(tool_name, tool_config)
            cached_result = await self.cache_manager.get(cache_key)
            
            if cached_result:
                results[tool_name] = cached_result
            else:
                # Execute tool
                tool_result = await self.execute_tool_analysis(tool_name, tool_config)
                results[tool_name] = tool_result
                
                # Cache result
                await self.cache_manager.set(cache_key, tool_result)
        
        # Synthesize results
        synthesized_result = await self.synthesize_analysis_results(results)
        
        return synthesized_result
    
    async def execute_tool_analysis(self, tool_name: str, tool_config: ToolConfiguration) -> ToolResult:
        """Execute specific MCP tool for analysis"""
        
        tool = self.mcp_tools[tool_name]
        
        if tool_name == 'filesystem':
            return await self.execute_filesystem_analysis(tool, tool_config)
        elif tool_name == 'code-analyzer':
            return await self.execute_code_analysis(tool, tool_config)
        elif tool_name == 'github':
            return await self.execute_github_analysis(tool, tool_config)
        elif tool_name == 'everything':
            return await self.execute_everything_analysis(tool, tool_config)
        elif tool_name == 'memory':
            return await self.execute_memory_analysis(tool, tool_config)
        elif tool_name == 'sequentialthinking':
            return await self.execute_sequential_analysis(tool, tool_config)
        else:
            raise ValueError(f"Unknown tool: {tool_name}")
```

## Quality Assurance and Validation

### Analysis Validation System

```python
class AnalysisValidationSystem:
    def __init__(self, mcp_tools):
        self.mcp_tools = mcp_tools
        self.validation_rules = ValidationRuleEngine()
        self.test_generator = TestGenerator()
    
    async def validate_analysis_results(self, analysis_result: DeepAnalysisResult) -> ValidationReport:
        """Validate analysis results for accuracy and completeness"""
        
        validation_report = ValidationReport()
        
        # Validate completeness
        completeness_validation = await self.validate_analysis_completeness(analysis_result)
        validation_report.completeness = completeness_validation
        
        # Validate accuracy
        accuracy_validation = await self.validate_analysis_accuracy(analysis_result)
        validation_report.accuracy = accuracy_validation
        
        # Validate consistency
        consistency_validation = await self.validate_analysis_consistency(analysis_result)
        validation_report.consistency = consistency_validation
        
        # Generate validation tests
        validation_tests = await self.test_generator.generate_validation_tests(analysis_result)
        validation_report.validation_tests = validation_tests
        
        # Calculate overall validation score
        validation_report.overall_score = self.calculate_validation_score(validation_report)
        
        return validation_report
    
    async def validate_analysis_completeness(self, analysis_result: DeepAnalysisResult) -> CompletenessValidation:
        """Validate that analysis covers entire codebase"""
        
        validation = CompletenessValidation()
        
        # Check file coverage
        validation.file_coverage = await self.check_file_coverage(analysis_result)
        
        # Check dependency coverage
        validation.dependency_coverage = await self.check_dependency_coverage(analysis_result)
        
        # Check architecture coverage
        validation.architecture_coverage = await self.check_architecture_coverage(analysis_result)
        
        # Check quality coverage
        validation.quality_coverage = await self.check_quality_coverage(analysis_result)
        
        return validation
```

This deep code analysis workflow ensures comprehensive understanding of the entire codebase, complete dependency mapping, thorough architecture analysis, and intelligent improvement recommendations while leveraging all available MCP tools for optimal performance and accuracy.
