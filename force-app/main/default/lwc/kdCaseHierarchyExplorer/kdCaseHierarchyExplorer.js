import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getCaseHierarchy from '@salesforce/apex/KD_CaseHierarchyController.getCaseHierarchy';

/** GRID COLUMNS ---------------------------------------------------------- */
const COLUMNS = [
    { 
        label: 'Case #', 
        fieldName: 'caseNumber',
        type: 'text',
        cellAttributes: {
            alignment: 'left'
        }
    },
    { label: 'Subject', fieldName: 'subject' },
    { label: 'Status',  fieldName: 'status' },
    {
        label: 'Child Count',
        fieldName: 'childCount',
        type: 'number',
        cellAttributes: { 
            alignment: 'left'
        },
        initialWidth: 100
    }
];

export default class KdCaseHierarchyExplorer extends NavigationMixin(LightningElement) {
    /* Lightning automatically injects recordId & objectApiName */
    @api recordId;
    @api objectApiName;

    constructor() {
        super();
        console.log('🔧 CONSTRUCTOR CALLED - Component loading...');
        console.log('🔧 CACHE BUSTER:', Date.now());
        console.log('🔧 Version: 8.0.0 - Enhanced Debugging and Child Count Fixes');
    }

    connectedCallback() {
        console.log('🔧 CONNECTED CALLBACK - Component connected!');
        console.log('🔧 recordId in connectedCallback:', this.recordId);
        console.log('🔧 objectApiName in connectedCallback:', this.objectApiName);
        console.log('🔧 Timestamp:', new Date().toISOString());
        console.log('🔧 Version: 8.0.0 - Enhanced Debugging and Child Count Fixes');
    }

    columns = COLUMNS;
    expandedRows = [];
    treeData   = { data: undefined, isLoading: true, error: undefined };

    /** Wire Apex --------------------------------------------------------- */
    @wire(getCaseHierarchy, { recordId: '$recordId', objectName: '$objectApiName' })
    wiredHierarchy({ data, error }) {
        console.log('🔧 WIRE METHOD CALLED');
        console.log('🔧 Data received:', data);
        console.log('🔧 Error received:', error);
        console.log('🔧 recordId:', this.recordId);
        console.log('🔧 objectApiName:', this.objectApiName);
        
        if (data) {
            console.log('🔧 PROCESSING DATA...');
            console.log('🔧 Raw data type:', typeof data);
            console.log('🔧 Raw data length:', Array.isArray(data) ? data.length : 'Not an array');
            console.log('🔧 Raw data:', JSON.stringify(data, null, 2));
            
            try {
                const clone = JSON.parse(JSON.stringify(data));
                console.log('🔧 Data cloned successfully');
                
                // Validate data structure before processing
                this.validateDataStructure(clone);
                
                this.processData(clone);
                console.log('🔧 Data processed successfully');
                this.treeData = { data: clone, isLoading: false, error: undefined };
                console.log('🔧 treeData set successfully');
            } catch (e) {
                console.error('🔧 ERROR processing data:', e);
                this.treeData = { data: undefined, isLoading: false, error: e };
            }
        } else if (error) {
            console.error('🔧 ERROR from server:', error);
            this.treeData = { data: undefined, isLoading: false, error };
        } else {
            console.log('🔧 LOADING STATE');
            this.treeData = { data: undefined, isLoading: true,  error: undefined };
        }
    }

    /** Validate data structure */
    validateDataStructure(nodes) {
        console.log('🔧 VALIDATING DATA STRUCTURE');
        if (!Array.isArray(nodes)) {
            console.error('🔧 ERROR: nodes is not an array!');
            return;
        }
        
        nodes.forEach((node, index) => {
            console.log(`🔧 Validating node ${index}:`, {
                id: node.id,
                caseNumber: node.caseNumber,
                hasChildren: Array.isArray(node.children),
                childrenLength: Array.isArray(node.children) ? node.children.length : 'N/A'
            });
        });
    }

    /** Process data with detailed logging */
    processData(nodes = []) {
        console.log('🔧 PROCESS DATA CALLED');
        console.log('🔧 Nodes to process:', nodes);
        console.log('🔧 Nodes type:', typeof nodes);
        console.log('🔧 Nodes is array:', Array.isArray(nodes));
        
        if (!Array.isArray(nodes)) {
            console.error('🔧 ERROR: nodes is not an array!');
            return;
        }
        
        nodes.forEach((node, index) => {
            console.log(`🔧 Processing node ${index}:`, node);
            
            // Normalize data
            node.id = node.id || node.Id || `unknown-${index}`;
            node.caseNumber = node.caseNumber || node.CaseNumber || node.Name || `Case-${index}`;
            node.subject = node.subject || node.Subject || '';
            node.status = node.status || node.Status || '';
            
            // Store the case URL for navigation (will be handled by row click)
            if (node.id && !node.id.includes('-dummy')) {
                node.caseUrl = `/${node.id}`;
            }
            
            // Calculate actual child count (excluding dummy children)
            let actualChildCount = 0;
            if (Array.isArray(node.children)) {
                actualChildCount = node.children.filter(child => !child.id.includes('-dummy')).length;
            }
            node.childCount = actualChildCount;
            
            console.log(`🔧 Node ${index} processed:`, {
                id: node.id,
                caseNumber: node.caseNumber,
                subject: node.subject,
                status: node.status,
                childCount: node.childCount,
                hasChildren: Array.isArray(node.children) && node.children.length > 0,
                totalChildren: Array.isArray(node.children) ? node.children.length : 0,
                dummyChildren: Array.isArray(node.children) ? node.children.filter(child => child.id.includes('-dummy')).length : 0
            });
            
            // Add dummy child if no children to make it expandable
            if (!node.children || node.children.length === 0) {
                console.log(`🔧 Adding dummy child for node ${index}:`, node.caseNumber);
                node.children = [{
                    id: `${node.id}-dummy`,
                    caseNumber: '—',
                    subject: '(No child cases)',
                    status: '',
                    childCount: 0,
                    children: []
                }];
                console.log(`🔧 Dummy child added for node ${index}`);
            } else {
                console.log(`🔧 Node ${index} has children, recursing...`);
                this.processData(node.children);
            }
        });
        
        console.log('🔧 PROCESS DATA COMPLETED');
    }

    /** Helpers ----------------------------------------------------------- */
    get hasError() {
        return this.treeData.error !== undefined;
    }

    get errorMessage() {
        return this.treeData.error?.body?.message || this.treeData.error?.message || 'Unknown error';
    }

    /** Preserve user-expanded rows for a smoother UX */
    handleToggle(event) {
        console.log('🔧 TOGGLE EVENT:', event.detail);
        this.expandedRows = event.detail.expandedRows;
    }

    /** Handle row click for case navigation */
    handleRowClick(event) {
        const row = event.detail.row;
        console.log('🔧 ROW CLICK:', row);
        
        if (row.caseUrl && !row.id.includes('-dummy')) {
            console.log('🔧 Navigating to case:', row.caseUrl);
            // Navigate to the case record
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: row.id,
                    objectApiName: 'Case',
                    actionName: 'view'
                }
            });
        }
    }
}
