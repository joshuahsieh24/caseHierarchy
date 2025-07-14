public with sharing class KD_CaseHierarchyController {

    /**
     * Returns a hard-coded hierarchy (1 parent + 2 children) for the skeleton UI.
     * In a later step you’ll replace this with real SOQL.
     */
    @AuraEnabled(cacheable=true)
    public static List<CaseWrapper> getHierarchy(Id recordId) {

        // ── Parent node ─────────────────────────────────────────────
        CaseWrapper parent = new CaseWrapper(
            '500xxx1', 'CA-1001', 'Parent Case', 'New'
        );

        // ── Child nodes ─────────────────────────────────────────────
        parent.children.add(new CaseWrapper(
            '500xxx2', 'CA-1002', 'Child A', 'Working'));

        parent.children.add(new CaseWrapper(
            '500xxx3', 'CA-1003', 'Child B', 'Closed'));

        // Return a list with the single root node
        return new List<CaseWrapper>{ parent };
    }

    /**
     * Wrapper that mimics Case fields and exposes a _children property
     * (required by lightning-tree-grid) via a getter method.
     */
    public class CaseWrapper {

        // ── Columns shown in the grid ──────────────────────────────
        @AuraEnabled public String id;
        @AuraEnabled public String caseNumber;
        @AuraEnabled public String subject;
        @AuraEnabled public String status;

        // Real storage for child nodes (legal Apex identifier)
        @AuraEnabled public List<CaseWrapper> children = new List<CaseWrapper>();

        // Expose the same list under the name _children for the UI
        @AuraEnabled public List<CaseWrapper> get_children() {
            return children;
        }

        public CaseWrapper() {} // Required for serialization

        public CaseWrapper(String id, String num, String subj, String stat) {
            this.id         = id;
            this.caseNumber = num;
            this.subject    = subj;
            this.status     = stat;
        }
    }
}
