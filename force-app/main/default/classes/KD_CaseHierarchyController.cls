/* =========================================================================
 * KD_CaseHierarchyController.cls
 * -------------------------------------------------------------------------
 *  ▸ Returns a nested hierarchy of CaseWrapper objects for a Lightning-
 *    Web Component tree-grid.  
 *  ▸ Now includes Priority & Type.  
 *  ▸ No longer fabricates an empty child placeholder.
 * ========================================================================= */
public with sharing class KD_CaseHierarchyController {

    /*-----------------------------------------------------------
     * PUBLIC – entry point
     *-----------------------------------------------------------*/
    @AuraEnabled(cacheable=true)
    public static CaseWrapper getHierarchy(Id contextRecordId) {
        // 1️⃣  Determine context (Account, Opportunity, or Case)
        Schema.SObjectType objType = contextRecordId.getSObjectType();

        Set<Id> rootIds = new Set<Id>();
        if (objType == Account.SObjectType) {
            for (Case c : [
                SELECT Id
                FROM Case
                WHERE AccountId = :contextRecordId
            ]) rootIds.add(c.Id);

        } else if (objType == Opportunity.SObjectType) {
            for (Case c : [
                SELECT Id
                FROM Case
                WHERE Opportunity__c = :contextRecordId
            ]) rootIds.add(c.Id);

        } else if (objType == Case.SObjectType) {
            rootIds.add(contextRecordId);
        }

        if (rootIds.isEmpty()) {
            // Return a placeholder wrapper to indicate no cases found
            return new CaseWrapper(
                'no-cases', 'No Cases', 
                'No cases found for this record', 'N/A', 'N/A', 'N/A'
            );
        }

        // 2️⃣  Bulk-fetch all descendant cases (1 SOQL using ParentId)
        Map<Id, CaseWrapper> wrapById = new Map<Id, CaseWrapper>();
        List<Case> cases = [
            SELECT Id, CaseNumber, Subject, Status,
                   Priority, Type, ParentId
            FROM Case
            WHERE Id               IN :rootIds
               OR ParentId         IN :rootIds
               OR Parent.ParentId  IN :rootIds   /* handles grandchildren */
        ];

        // 3️⃣  Build wrappers & child links
        for (Case c : cases) {
            wrapById.put(
                c.Id,
                new CaseWrapper(
                    c.Id,            c.CaseNumber,
                    c.Subject,       c.Status,
                    c.Priority,      c.Type
                )
            );
        }
        for (Case c : cases) {
            if (c.ParentId != null && wrapById.containsKey(c.ParentId)) {
                wrapById.get(c.ParentId).children.add(
                    wrapById.get(c.Id)
                );
            }
        }

        // 4️⃣  Calculate #children; return first root wrapper
        for (CaseWrapper w : wrapById.values()) {
            w.childCount = w.children.size();
        }
        return wrapById.get(rootIds.iterator().next());
    }

    /*-----------------------------------------------------------
     * INNER CLASS – wrapper for LWC
     *-----------------------------------------------------------*/
    public class CaseWrapper {
        /* core fields sent to the client */
        @AuraEnabled public String  id;
        @AuraEnabled public String  caseNumber;
        @AuraEnabled public String  subject;
        @AuraEnabled public String  status;
        @AuraEnabled public String  priority;     // NEW
        @AuraEnabled public String  caseType;     // NEW
        @AuraEnabled public Integer childCount;
        @AuraEnabled public List<CaseWrapper> children = new List<CaseWrapper>();

        /* getter so Lightning can access nested children */
        @AuraEnabled
        public List<CaseWrapper> get_children() { return children; }

        /* constructor */
        public CaseWrapper(String id,
                           String num,
                           String subj,
                           String stat,
                           String pri,
                           String typ) {
            this.id         = id;
            this.caseNumber = num;
            this.subject    = subj;
            this.status     = stat;
            this.priority   = pri;
            this.caseType   = typ;
            this.childCount = 0;
        }
    }
}